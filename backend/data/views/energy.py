# views/energy.py
# API tính năng lượng tiêu thụ theo khoảng thời gian (giờ/tuần/tháng/năm)
#
# ĐỘNG (không hard-code meter): tự lấy tất cả meter của user + tự tìm
# register năng lượng theo từ khóa trong tên. Thêm meter mới → tự hiện.
#
# Nguyên lý: thanh ghi energy là bộ đếm TÍCH LŨY (chỉ tăng)
#   → tiêu thụ trong 1 bucket = max(value) - min(value) trong bucket đó
#   → bỏ delta âm (đồng hồ reset / tràn số)

from django.http import JsonResponse
from django.utils.timezone import make_aware, localdate
from datetime import datetime, timedelta, time
from collections import defaultdict

from data.models import Meter, MeterRegister, Site

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated


# ── TỪ KHÓA nhận diện register năng lượng ────────────────────────────────────
# Backend tự quét register_name của mỗi meter, register nào chứa 1 trong các
# từ khóa này (không phân biệt hoa thường) → coi là register năng lượng.
#
# CHỈNH Ở ĐÂY nếu tên register trong DB của bạn khác:
#   - Kiểm tra tên thật: SELECT DISTINCT register_name FROM meter_register;
#   - Thêm/bớt từ khóa cho khớp
ENERGY_KEYWORDS = [
    "energy",          # Active-Energy, Real-Energy, Total Energy...
    "kwh",             # nếu đặt tên theo đơn vị
    "active-energy",
    "real-energy",
    "forward-active",
]

# ── Scale đổi đơn vị → kWh ───────────────────────────────────────────────────
# Nếu DB lưu Wh, muốn ra kWh → 0.001. Nếu DB đã là kWh → 1.0
ENERGY_SCALE = 1.0

# Bảng màu tự gán cho meter (xoay vòng nếu nhiều meter hơn số màu)
COLOR_PALETTE = [
    "#00bcd4", "#4dd0e1", "#ffb74d", "#81c784", "#ba68c8",
    "#f06292", "#7986cb", "#a1887f", "#4db6ac", "#dce775",
]


# ── Kiểm tra 1 register có phải năng lượng không ─────────────────────────────
def is_energy_register(register_name):
    if not register_name:
        return False
    name_lower = register_name.lower()
    return any(kw in name_lower for kw in ENERGY_KEYWORDS)


# ── Tính các mốc bucket theo mode ────────────────────────────────────────────
def get_bucket_ranges(mode, base_date):
    """Trả về list [(start, end), ...] — mỗi phần tử là 1 cột trên biểu đồ."""
    ranges = []

    if mode == "hour":
        for h in range(24):
            start = make_aware(datetime.combine(base_date, time(h, 0)))
            ranges.append((start, start + timedelta(hours=1)))

    elif mode == "week":
        monday = base_date - timedelta(days=base_date.weekday())
        for d in range(7):
            day   = monday + timedelta(days=d)
            start = make_aware(datetime.combine(day, time(0, 0)))
            ranges.append((start, start + timedelta(days=1)))

    elif mode == "month":
        first = base_date.replace(day=1)
        for w in range(4):
            start = make_aware(datetime.combine(first + timedelta(weeks=w), time(0, 0)))
            ranges.append((start, start + timedelta(weeks=1)))

    elif mode == "year":
        for m in range(1, 13):
            start = make_aware(datetime(base_date.year, m, 1))
            if m == 12:
                end = make_aware(datetime(base_date.year + 1, 1, 1))
            else:
                end = make_aware(datetime(base_date.year, m + 1, 1))
            ranges.append((start, end))

    return ranges


# ── Lấy timeline (thời điểm, tổng năng lượng tích lũy) của 1 meter ───────────
def get_meter_timeline(meter_id, energy_reg_names, start, end):
    """
    Cộng tất cả register năng lượng của meter tại mỗi received_at.
    Tự xử lý cả meter có total (1 register) lẫn meter chỉ có 3 pha L1/L2/L3.
    Trả về [(received_at, tong_tich_luy), ...] sort theo thời gian.
    """
    qs = MeterRegister.objects.filter(
        meter_id          = meter_id,
        register_name__in = energy_reg_names,
        received_at__gte  = start,
        received_at__lt   = end,
    ).order_by("received_at")

    # Group theo received_at rồi cộng tất cả register năng lượng tại thời điểm đó
    # (nếu meter có total → chỉ 1 register; nếu chỉ có pha → cộng L1+L2+L3)
    grouped = defaultdict(float)
    for r in qs:
        if r.value is None:
            continue
        try:
            grouped[r.received_at] += float(r.value)
        except (ValueError, TypeError):
            pass

    return sorted(grouped.items())


# ── Tính delta tiêu thụ cho từng bucket ──────────────────────────────────────
def compute_bucket_deltas(timeline, bucket_ranges, scale):
    deltas = []
    for (b_start, b_end) in bucket_ranges:
        in_bucket = [v for (t, v) in timeline if b_start <= t < b_end]
        if len(in_bucket) >= 2:
            delta = max(in_bucket) - min(in_bucket)
            delta = max(0.0, delta) * scale     # bỏ delta âm
            deltas.append(round(delta, 2))
        else:
            deltas.append(0)
    return deltas


# ── API endpoint ─────────────────────────────────────────────────────────────
@api_view(["GET"])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def energy_chart(request):
    mode     = request.GET.get("type", "hour")
    date_str = request.GET.get("date")
    site_id  = request.GET.get("site_id")   # optional: lọc theo 1 site

    if mode not in ("hour", "week", "month", "year"):
        return JsonResponse({"error": "type không hợp lệ"}, status=400)

    # Ngày gốc
    if date_str:
        try:
            base_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            base_date = localdate()
    else:
        base_date = localdate()

    # ── Lấy meter của user (ĐỘNG, không hard-code) ──────────────────────────
    user_site_ids = Site.objects.filter(user=request.user).values_list("site_id", flat=True)

    meters_qs = Meter.objects.filter(site_id__in=user_site_ids)
    if site_id:
        meters_qs = meters_qs.filter(site_id=site_id)

    meters = list(meters_qs.order_by("meter_id"))

    # Bucket ranges
    bucket_ranges = get_bucket_ranges(mode, base_date)
    if not bucket_ranges:
        return JsonResponse({"error": "Không tính được bucket"}, status=400)

    range_start = bucket_ranges[0][0]
    range_end   = bucket_ranges[-1][1]

    # Nhãn trục X (tiếng Anh)
    X_LABELS = {
        "hour":  [f"{h:02d}h" for h in range(24)],
        "week":  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "month": ["Week 1", "Week 2", "Week 3", "Week 4"],
        "year":  ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    }

    # ── Tính cho từng meter ─────────────────────────────────────────────────
    # series: danh sách meter kèm dữ liệu — frontend đọc cái này để vẽ động
    series = []

    for idx, m in enumerate(meters):
        # Tìm các register năng lượng của meter này (ĐỘNG)
        all_reg_names = MeterRegister.objects.filter(
            meter_id = m.meter_id
        ).values_list("register_name", flat=True).distinct()

        energy_reg_names = [n for n in all_reg_names if is_energy_register(n)]

        # Meter không có register năng lượng → bỏ qua (vd weather station)
        if not energy_reg_names:
            continue

        timeline = get_meter_timeline(
            m.meter_id, energy_reg_names, range_start, range_end
        )
        data = compute_bucket_deltas(timeline, bucket_ranges, ENERGY_SCALE)

        series.append({
            "key":      f"ID{m.meter_id}",
            "meter_id": m.meter_id,
            "label":    f"{m.meter_name} (ID{m.meter_id})",
            "color":    COLOR_PALETTE[idx % len(COLOR_PALETTE)],
            "data":     data,
        })

    return JsonResponse({
        "labels": X_LABELS[mode],
        "series": series,    # ← mảng động, bao nhiêu meter cũng được
    })