from django.db import models
from django.utils import timezone
from .site import Site


# ============================================================
# MODEL 1: ScanResult
# ============================================================
class ScanResult(models.Model):

    SEVERITY_CHOICES = [
        ('ok',      'OK'),
        ('warning', 'Warning'),
    ]

    # ── Khóa ngoại ───────────────────────────────────────────
    site = models.ForeignKey(
        Site,
        on_delete    = models.CASCADE,
        related_name = 'scan_results',
        db_column    = 'site_id',
    )

    # ── Thời gian ─────────────────────────────────────────────
    scanned_at = models.DateTimeField(default=timezone.now, db_index=True)

    # ── Trạng thái tổng quan ──────────────────────────────────
    severity = models.CharField(
        max_length = 10,
        choices    = SEVERITY_CHOICES,
        default    = 'ok',
    )

    # ── Kết quả kiểm tra dây ─────────────────────────────────
    wire_p1_ok  = models.BooleanField(default=False)
    wire_p2_ok  = models.BooleanField(default=False)
    active_port = models.IntegerField(default=0)

    # ── Vị trí điểm đứt dây ──────────────────────────────────
    # final_id_p1: index trong original_id[] của ID cuối cùng Port 1 thấy được
    #   = -1  → Port 1 không thấy thiết bị nào (đứt ngay đầu P1)
    #   = 0   → Port 1 chỉ thấy thiết bị đầu tiên
    #   = n-1 → Port 1 thấy hết (không đứt phía P1)
    #
    # final_id_p2: index trong original_id[] của ID cuối cùng Port 2 thấy được
    #   = total_devices   → Port 2 không thấy thiết bị nào (giá trị mặc định)
    #   = total_devices-1 → Port 2 thấy hết (không đứt phía P2)
    #   = 0               → Port 2 chỉ thấy thiết bị đầu tiên
    #
    # Cách dùng để xác định vị trí đứt:
    #   final_p1=-1, final_p2=0  → đứt đoạn A (trước M1)
    #   final_p1=0,  final_p2=1  → đứt đoạn B (giữa M1-M2)
    #   final_p1=1,  final_p2=2  → đứt đoạn C (giữa M2-M3)
    #   final_p1=2,  final_p2=3  → đứt đoạn D (sau M3)
    #   final_p1+1 < final_p2    → đứt 2 chỗ
    final_id_p1 = models.IntegerField(default=-1)
    final_id_p2 = models.IntegerField(default=0)

    # ── Số lượng tổng hợp ─────────────────────────────────────
    total_devices  = models.IntegerField(default=0)
    active_count   = models.IntegerField(default=0)
    inactive_count = models.IntegerField(default=0)

    # ── THÊM MỚI: Trạng thái dual port và đường dây ──────────
    # dual_port_mode: ESP32 đang poll cả 2 port do phát hiện đứt dây giữa chừng
    #   True  → đang dùng dual port, mỗi port poll 1 phần thiết bị
    #   False → bình thường, 1 port poll toàn bộ
    #
    # line_ok: đường truyền vật lý có thông không (wire_p1_ok OR wire_p2_ok)
    #   True  → ít nhất 1 port wire check OK (dây thông)
    #   False → cả 2 port đều không wire check OK (đứt hoàn toàn)
    dual_port_mode = models.BooleanField(default=False)
    line_ok        = models.BooleanField(default=True)

    class Meta:
        db_table = 'scan_result'
        ordering = ['-scanned_at']
        indexes  = [
            models.Index(fields=['site', 'scanned_at']),
        ]

    def __str__(self):
        return f"Scan [{self.site_id}] at {self.scanned_at} — {self.severity}"


# ============================================================
# MODEL 2: ScanDevice — GIỮ NGUYÊN
# ============================================================
class ScanDevice(models.Model):

    STATUS_CHOICES = [
        ('active',   'Active'),
        ('inactive', 'Inactive'),
    ]

    scan_result = models.ForeignKey(
        ScanResult,
        on_delete    = models.CASCADE,
        related_name = 'devices',
    )

    modbus_id = models.IntegerField()
    status    = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    port      = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'scan_device'
        indexes  = [
            models.Index(fields=['scan_result', 'status']),
        ]

    def __str__(self):
        return f"Device ID {self.modbus_id} — {self.status} (Scan #{self.scan_result_id})"