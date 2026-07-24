import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
    Select, MenuItem, FormControl, InputLabel, IconButton, Chip, CircularProgress,
    TextField, Divider, Tooltip, Autocomplete, Popover,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon           from "@mui/icons-material/Add";
import EditIcon          from "@mui/icons-material/Edit";
import DeleteIcon        from "@mui/icons-material/Delete";
import ArrowBackIcon     from "@mui/icons-material/ArrowBack";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import LocationOnIcon    from "@mui/icons-material/LocationOn";
import RouterIcon        from "@mui/icons-material/Router";
import CloseIcon         from "@mui/icons-material/Close";
import OpenInFullIcon    from "@mui/icons-material/OpenInFull";
import WarningAmberIcon  from "@mui/icons-material/WarningAmber";
import TodayIcon         from "@mui/icons-material/Today";
import EventIcon         from "@mui/icons-material/Event";
import { DatePicker }           from "@mui/x-date-pickers/DatePicker";
import { DateCalendar }         from "@mui/x-date-pickers/DateCalendar";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs }         from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter,
    PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from "@dnd-kit/core";
import {
    SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getData, postData } from "../ApiComponent/api";
import { WS_BASE } from "../config";

// ── Constants ──────────────────────────────────────────────────────────────────

const METER_COLORS = [
    "#4fc3f7", "#81c784", "#ffb74d", "#f06292",
    "#ba68c8", "#4db6ac", "#ff8a65", "#a1887f",
];

const CHART_TYPES = [
    { value: "line",    label: "Line" },
    { value: "area",    label: "Area" },
    { value: "bar",     label: "Bar" },
    { value: "scatter", label: "Scatter" },
    { value: "pie",     label: "Pie" },
    { value: "donut",   label: "Donut" },
];

// Chart types that show ONE aggregated value per meter (tổng cả kỳ) thay vì
// một chuỗi thời gian — layout render khác hẳn line/bar/scatter/area.
const AGGREGATE_CHART_TYPES = new Set(["pie", "donut"]);

const MAX_WIDGETS = 8;

// ── Layout helpers ─────────────────────────────────────────────────────────────

function getGridCols(count) {
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count <= 4) return 2;
    if (count <= 6) return 3;
    return 4;
}

// ── Color helpers ──────────────────────────────────────────────────────────────

function getMeterColor(meter, allMeters, colorMap) {
    const custom = colorMap?.[String(meter.meter_id)];
    if (custom) return custom;
    const idx = allMeters.findIndex(m => m.meter_id === meter.meter_id);
    return METER_COLORS[(idx < 0 ? 0 : idx) % METER_COLORS.length];
}

// ── Data helpers ───────────────────────────────────────────────────────────────

function mergeTimeSeries(seriesMap) {
    const timeSet = new Set();
    Object.values(seriesMap).forEach(s => s.forEach(p => timeSet.add(p.time)));
    const times = Array.from(timeSet).sort();
    return times.map(t => {
        const point = { time: t };
        Object.entries(seriesMap).forEach(([mid, s]) => {
            const found = s.find(p => p.time === t);
            if (found !== undefined) point[`m_${mid}`] = found.value;
        });
        return point;
    });
}

// ── Site Select Screen ─────────────────────────────────────────────────────────

function SiteSelectScreen({ onSelect }) {
    const theme       = useTheme();
    const isDark      = theme.palette.mode === "dark";
    const accentColor = isDark ? "#00bcd4" : theme.palette.primary.main;
    const [sites,   setSites]   = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getData("/solardb/get-my-sites/").then(data => {
            if (Array.isArray(data)) setSites(data);
            setLoading(false);
        });
    }, []);

    return (
        <Box sx={{ padding: "24px" }}>
            <Typography fontSize={14} color="text.secondary" sx={{ mb: 3 }}>
                Select a site to view its Dashboard:
            </Typography>

            {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                    <CircularProgress size={28} />
                </Box>
            ) : (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                    {sites.map(site => (
                        <Box
                            key={site.site_id}
                            onClick={() => onSelect(site)}
                            sx={{
                                cursor: "pointer", padding: "20px 24px", borderRadius: 2,
                                border: theme.palette.border.box,
                                backgroundColor: theme.palette.background.option,
                                minWidth: 220,
                                transition: "border-color 0.2s, box-shadow 0.2s",
                                "&:hover": {
                                    borderColor: accentColor,
                                    boxShadow: `0 0 0 1px ${accentColor}44`,
                                },
                            }}
                        >
                            <Typography fontWeight="bold" fontSize={15}
                                sx={{ color: theme.palette.text.header_option, mb: 1 }}>
                                {site.site_name}
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                                <LocationOnIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                                <Typography fontSize={12} color="text.secondary">{site.location || "—"}</Typography>
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <RouterIcon sx={{ fontSize: 13, color: "text.secondary" }} />
                                <Typography fontSize={11} color="text.secondary" fontFamily="monospace">
                                    {site.gateway_id || "—"}
                                </Typography>
                            </Box>
                        </Box>
                    ))}
                    {sites.length === 0 && (
                        <Typography fontSize={13} color="text.secondary">No sites found.</Typography>
                    )}
                </Box>
            )}
        </Box>
    );
}

// ── Delete Confirmation Dialog ─────────────────────────────────────────────────

function DeleteConfirmDialog({ open, widgetLabel, onConfirm, onClose }) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
                <WarningAmberIcon sx={{ color: "#f59e0b", fontSize: 22 }} />
                Delete Widget
            </DialogTitle>
            <DialogContent>
                <Typography fontSize={14}>
                    Are you sure you want to delete{" "}
                    <strong>&ldquo;{widgetLabel || "this widget"}&rdquo;</strong>?
                    This action cannot be undone.
                </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                <Button onClick={onClose} size="small" variant="outlined">Cancel</Button>
                <Button onClick={onConfirm} size="small" variant="contained" color="error">
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ── Add / Edit Dialog ──────────────────────────────────────────────────────────

function AddEditDialog({ open, meters, initialWidget, onSave, onClose }) {
    const [label,          setLabel]          = useState("");
    const [chartType,      setChartType]      = useState("line");
    const [meterRegMap,    setMeterRegMap]    = useState({});
    const [meterColorMap,  setMeterColorMap]  = useState({});
    const [meterRegisters, setMeterRegisters] = useState({});
    const [loadingRegs,    setLoadingRegs]    = useState(false);

    useEffect(() => {
        if (!open) return;
        setLabel(initialWidget?.label ?? "");
        setChartType(initialWidget?.chartType ?? "line");

        const initReg = {};
        const initColor = {};
        meters.forEach((m, i) => {
            const mid = String(m.meter_id);
            initReg[mid]   = initialWidget?.meterRegisterMap?.[mid] ?? "";
            initColor[mid] = initialWidget?.meterColorMap?.[mid]
                ?? METER_COLORS[i % METER_COLORS.length];
        });
        setMeterRegMap(initReg);
        setMeterColorMap(initColor);

        setLoadingRegs(true);
        Promise.all(
            meters.map(m =>
                getData(`/solardb/get-meter-registers/${m.meter_id}/`).then(data => [
                    String(m.meter_id),
                    Array.isArray(data)
                        ? data.map(r => ({ name: r.parameter_name, unit: r.unit ?? "" }))
                        : [],
                ])
            )
        ).then(results => {
            setMeterRegisters(Object.fromEntries(results));
            setLoadingRegs(false);
        });
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const setMeterReg   = (mid, val) => setMeterRegMap(prev => ({ ...prev, [mid]: val }));
    const setMeterColor = (mid, val) => setMeterColorMap(prev => ({ ...prev, [mid]: val }));

    const activeMappings = Object.entries(meterRegMap).filter(([, v]) => v !== "");
    const canSave = activeMappings.length > 0;

    const handleSave = () => {
        if (!canSave) return;
        const filteredMap = Object.fromEntries(activeMappings);
        const filteredColors = Object.fromEntries(
            activeMappings.map(([mid]) => [mid, meterColorMap[mid]])
        );
        const autoLabel = label.trim() ||
            Object.values(filteredMap).sort((a, b) =>
                Object.values(filteredMap).filter(v => v === b).length -
                Object.values(filteredMap).filter(v => v === a).length
            )[0] || "";
        onSave({ label: autoLabel, chartType, meterRegisterMap: filteredMap, meterColorMap: filteredColors });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ pb: 1 }}>
                {initialWidget ? "Edit Widget" : "Add Widget"}
            </DialogTitle>

            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "12px !important" }}>
                <TextField
                    label="Widget Label" size="small" fullWidth
                    value={label} onChange={e => setLabel(e.target.value)}
                    placeholder="e.g. Voltage Phase 1"
                />
                <FormControl fullWidth size="small">
                    <InputLabel>Chart Type</InputLabel>
                    <Select value={chartType} label="Chart Type" onChange={e => setChartType(e.target.value)}>
                        {CHART_TYPES.map(ct => (
                            <MenuItem key={ct.value} value={ct.value}>{ct.label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Divider />

                <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
                    Select a parameter and color for each meter. Meters set to "None" will be excluded.
                </Typography>

                {loadingRegs ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                        <CircularProgress size={20} />
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, maxHeight: 340, overflowY: "auto", pr: 0.5 }}>
                        {meters.map((m, i) => {
                            const mid      = String(m.meter_id);
                            const regs     = meterRegisters[mid] ?? [];
                            const selected = meterRegMap[mid] ?? "";
                            const color    = meterColorMap[mid] ?? METER_COLORS[i % METER_COLORS.length];
                            const active   = selected !== "";
                            return (
                                <Box key={mid} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    {/* Meter label */}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant="caption" noWrap fontWeight="bold">
                                            {m.meter_name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
                                            {m.site_name}
                                        </Typography>
                                    </Box>

                                    {/* Register select with search */}
                                    <Autocomplete
                                        size="small"
                                        sx={{ minWidth: 220 }}
                                        options={regs}
                                        getOptionLabel={r => `${r.name}${r.unit ? ` (${r.unit})` : ""}`}
                                        value={regs.find(r => r.name === selected) ?? null}
                                        onChange={(_, newVal) => setMeterReg(mid, newVal?.name ?? "")}
                                        isOptionEqualToValue={(opt, val) => opt.name === val.name}
                                        noOptionsText="No matching parameters"
                                        renderInput={params => (
                                            <TextField
                                                {...params}
                                                placeholder="— None —"
                                                size="small"
                                                inputProps={{
                                                    ...params.inputProps,
                                                    style: { fontSize: 12 },
                                                }}
                                            />
                                        )}
                                        renderOption={(props, r) => (
                                            <Box component="li" {...props} sx={{ fontSize: 12, py: "4px !important" }}>
                                                <Typography variant="caption" sx={{ fontWeight: 500 }}>
                                                    {r.name}
                                                </Typography>
                                                {r.unit && (
                                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 0.75 }}>
                                                        ({r.unit})
                                                    </Typography>
                                                )}
                                            </Box>
                                        )}
                                    />

                                    {/* Color picker — only enabled when a register is selected */}
                                    <Tooltip title={active ? "Pick color" : "Select a parameter first"} placement="top">
                                        <Box
                                            component="input"
                                            type="color"
                                            value={color}
                                            disabled={!active}
                                            onChange={e => setMeterColor(mid, e.target.value)}
                                            sx={{
                                                width: 32, height: 32, p: "2px",
                                                border: "1px solid rgba(128,128,128,0.35)",
                                                borderRadius: "6px",
                                                cursor: active ? "pointer" : "not-allowed",
                                                backgroundColor: "transparent",
                                                opacity: active ? 1 : 0.35,
                                                flexShrink: 0,
                                            }}
                                        />
                                    </Tooltip>
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} size="small">Cancel</Button>
                <Button onClick={handleSave} disabled={!canSave} variant="contained" size="small">Save</Button>
            </DialogActions>
        </Dialog>
    );
}

// ── Chart renderer ─────────────────────────────────────────────────────────────

function WidgetChart({ chartType, data, visibleMeters, allMeters, colorMap = {}, unit, zoomed = false }) {
    const theme     = useTheme();
    const tickColor = theme.palette.text.primary;
    const gridColor = theme.palette.mode === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)";
    const tooltipBg = theme.palette.background.paper;
    const fs        = zoomed ? 12 : 10;

    const xInterval = data.length > 12 ? Math.ceil(data.length / 12) - 1 : 0;
    const margin    = { top: 8, right: 16, left: 0, bottom: 4 };

    const xAxis = (
        <XAxis dataKey="time" height={34} interval={xInterval}
            axisLine={{ stroke: tickColor }} tickLine={{ stroke: tickColor }}
            tick={props => (
                <text x={props.x} y={props.y + 13} textAnchor="middle" fill={tickColor} fontSize={fs}>
                    {props.payload.value}
                </text>
            )}
        />
    );
    const yAxis = (
        <YAxis width={unit ? 68 : 52}
            axisLine={{ stroke: tickColor }} tickLine={{ stroke: tickColor }}
            tick={props => (
                <text x={props.x - 2} y={props.y} textAnchor="end" dominantBaseline="central" fill={tickColor} fontSize={fs}>
                    {typeof props.payload.value === "number" ? props.payload.value.toLocaleString() : props.payload.value}
                </text>
            )}
            label={unit ? { value: unit, angle: -90, position: "insideLeft", offset: 14, style: { fill: tickColor, fontSize: zoomed ? 13 : 10 } } : undefined}
        />
    );
    const grid    = <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />;
    const tooltip = (
        <RTooltip
            contentStyle={{ fontSize: zoomed ? 13 : 11, backgroundColor: tooltipBg, border: `1px solid ${gridColor}` }}
            labelStyle={{ color: tickColor, fontWeight: "bold" }}
        />
    );
    const legend = zoomed ? <Legend wrapperStyle={{ fontSize: 13, color: tickColor }} /> : null;

    const getColor = m => getMeterColor(m, allMeters, colorMap);

    if (AGGREGATE_CHART_TYPES.has(chartType)) {
        // Pie/Donut: mỗi meter gộp thành 1 lát — tổng giá trị cả kỳ đang xem.
        const pieData = visibleMeters
            .map(m => {
                const key   = `m_${m.meter_id}`;
                const total = data.reduce((sum, pt) => (
                    typeof pt[key] === "number" ? sum + pt[key] : sum
                ), 0);
                return { name: m.meter_name, value: total, color: getColor(m) };
            })
            .filter(d => d.value > 0);

        return (
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    {tooltip}{legend}
                    <Pie
                        data={pieData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%"
                        innerRadius={chartType === "donut" ? "55%" : 0}
                        outerRadius="80%"
                        label={zoomed ? ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%` : false}
                    >
                        {pieData.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
        );
    }

    if (chartType === "area") return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={margin}>
                {grid}{xAxis}{yAxis}{tooltip}{legend}
                {visibleMeters.map(m => (
                    <Area key={m.meter_id} type="monotone" dataKey={`m_${m.meter_id}`}
                        name={m.meter_name} stroke={getColor(m)} fill={getColor(m)}
                        fillOpacity={0.3} strokeWidth={zoomed ? 2.5 : 2} />
                ))}
            </AreaChart>
        </ResponsiveContainer>
    );

    if (chartType === "bar") return (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={margin}>
                {grid}{xAxis}{yAxis}{tooltip}{legend}
                {visibleMeters.map(m => (
                    <Bar key={m.meter_id} dataKey={`m_${m.meter_id}`} name={m.meter_name} fill={getColor(m)} />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );

    if (chartType === "scatter") return (
        <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={margin}>
                {grid}{xAxis}{yAxis}{tooltip}{legend}
                {visibleMeters.map(m => {
                    const pts = data
                        .map((pt, idx) => ({ x: idx, y: pt[`m_${m.meter_id}`], time: pt.time }))
                        .filter(p => p.y != null);
                    return (
                        <Scatter key={m.meter_id} name={m.meter_name} data={pts} fill={getColor(m)} />
                    );
                })}
            </ScatterChart>
        </ResponsiveContainer>
    );

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={margin}>
                {grid}{xAxis}{yAxis}{tooltip}{legend}
                {visibleMeters.map(m => (
                    <Line key={m.meter_id} type="monotone" dataKey={`m_${m.meter_id}`}
                        name={m.meter_name} stroke={getColor(m)}
                        dot={false} strokeWidth={zoomed ? 2.5 : 2} />
                ))}
            </LineChart>
        </ResponsiveContainer>
    );
}

// ── Widget Zoom Dialog ─────────────────────────────────────────────────────────

function WidgetZoomDialog({ widget, meters, open, onClose }) {
    const theme = useTheme();

    const activeMeters = useMemo(
        () => meters.filter(m => widget?.meterRegisterMap?.[String(m.meter_id)]),
        [meters, widget]
    );

    const [chartData,    setChartData]    = useState([]);
    const [unit,         setUnit]         = useState("");
    const [loading,      setLoading]      = useState(false);
    const [hiddenMeters, setHiddenMeters] = useState([]);
    const [widgetDate,   setWidgetDate]   = useState(dayjs());

    // Sync date & reset state whenever we open a (different) widget
    useEffect(() => {
        if (open && widget) {
            setWidgetDate(widget.selectedDate ? dayjs(widget.selectedDate) : dayjs());
            setChartData([]);
            setUnit("");
            setHiddenMeters([]);
        }
    }, [open, widget?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const isToday = widgetDate.isSame(dayjs(), "day");

    const fetchData = useCallback(async () => {
        if (!widget || activeMeters.length === 0) { setLoading(false); return; }
        setLoading(true);
        const dateParam   = `&date=${widgetDate.format("YYYY-MM-DD")}`;
        const seriesMap   = {};
        let   detectedUnit = "";

        await Promise.all(
            activeMeters.map(async m => {
                const registerName = widget.meterRegisterMap[String(m.meter_id)];
                const records = await getData(
                    `/solardb/get-register-history/?meter_id=${m.meter_id}` +
                    `&register_name=${encodeURIComponent(registerName)}${dateParam}`
                );
                if (Array.isArray(records) && records.length > 0) {
                    if (!detectedUnit && records[0].unit && records[0].unit !== "--")
                        detectedUnit = records[0].unit;
                    seriesMap[m.meter_id] = records.map(r => ({
                        time:  typeof r.received_at === "string" ? r.received_at.substring(11, 16) : "--",
                        value: typeof r.value === "number" ? r.value : null,
                    }));
                }
            })
        );
        setUnit(detectedUnit);
        setChartData(mergeTimeSeries(seriesMap));
        setLoading(false);
    }, [widget, activeMeters, widgetDate]);

    useEffect(() => {
        if (open && widget) fetchData();
    }, [open, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

    // Live WS when dialog is open and showing today
    useEffect(() => {
        if (!open || !isToday || activeMeters.length === 0 || loading || !widget) return;
        const token   = sessionStorage.getItem("token");
        const sockets = activeMeters.map(m => {
            const registerName = widget.meterRegisterMap[String(m.meter_id)];
            const ws = new WebSocket(`${WS_BASE}/ws/meter_register/${m.meter_id}/?token=${token}`);
            ws.onmessage = (e) => {
                try {
                    const records = JSON.parse(e.data);
                    const match   = records.find(r => r.parameter_name === registerName);
                    if (!match || match.value == null) return;
                    const time  = typeof match.timestamp === "string" ? match.timestamp.substring(11, 16) : "--";
                    const value = typeof match.value === "number" ? match.value : null;
                    const key   = `m_${m.meter_id}`;
                    if (match.unit && match.unit !== "--") setUnit(u => u || match.unit);
                    setChartData(prev => {
                        const idx = prev.findIndex(pt => pt.time === time);
                        if (idx >= 0) { const u = [...prev]; u[idx] = { ...u[idx], [key]: value }; return u; }
                        return [...prev, { time, [key]: value }];
                    });
                } catch (_) {}
            };
            return ws;
        });
        return () => sockets.forEach(ws => ws.close());
    }, [open, isToday, activeMeters, widget, loading]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleMeter = mid =>
        setHiddenMeters(prev => prev.includes(mid) ? prev.filter(x => x !== mid) : [...prev, mid]);

    const visibleMeters = activeMeters.filter(m => !hiddenMeters.includes(m.meter_id));

    if (!widget) return null;

    const colorMap = widget.meterColorMap ?? {};

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth
            PaperProps={{ sx: { height: "82vh", display: "flex", flexDirection: "column",
                                backgroundColor: (t) => t.palette.background.box } }}>

            {/* Header */}
            <Box sx={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                px: 2.5, py: 1.5, flexShrink: 0,
                backgroundColor: (t) => t.palette.background.head_box,
                borderBottom: "1px solid rgba(128,128,128,0.2)",
            }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography fontWeight="bold" fontSize={16}>{widget.label || "Widget"}</Typography>
                    <Typography variant="caption" color="text.secondary" fontSize={12}>
                        {CHART_TYPES.find(c => c.value === widget.chartType)?.label} chart
                    </Typography>
                    {isToday && !loading && (
                        <Box sx={{
                            width: 8, height: 8, borderRadius: "50%", backgroundColor: "#4caf50",
                            "@keyframes pulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.3 } },
                            animation: "pulse 1.8s ease-in-out infinite",
                        }} />
                    )}
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker value={widgetDate} onChange={v => v && setWidgetDate(v)} disableFuture
                            slotProps={{
                                textField: {
                                    size: "small", variant: "outlined",
                                    sx: { width: 140, "& .MuiInputBase-input": { fontSize: 13, py: "6px" } },
                                },
                            }}
                        />
                    </LocalizationProvider>
                    <Tooltip title="Close">
                        <IconButton size="small" onClick={onClose} sx={{ color: "text.secondary" }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Chart */}
            <Box sx={{ flex: 1, minHeight: 0, p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Box sx={{ flex: 1, minHeight: 0 }}>
                    {loading ? (
                        <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <CircularProgress size={32} />
                        </Box>
                    ) : activeMeters.length === 0 ? (
                        <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Typography color="text.secondary">No meters configured</Typography>
                        </Box>
                    ) : chartData.length === 0 ? (
                        <Box sx={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Typography color="text.secondary">
                                No data for {widgetDate.format("DD/MM/YYYY")}
                            </Typography>
                        </Box>
                    ) : (
                        <WidgetChart
                            chartType={widget.chartType}
                            data={chartData}
                            visibleMeters={visibleMeters}
                            allMeters={meters}
                            colorMap={colorMap}
                            unit={unit}
                            zoomed
                        />
                    )}
                </Box>

                {/* Legend chips */}
                {activeMeters.length > 0 && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, flexShrink: 0 }}>
                        {activeMeters.map(m => {
                            const hidden  = hiddenMeters.includes(m.meter_id);
                            const color   = getMeterColor(m, meters, colorMap);
                            const regName = widget.meterRegisterMap[String(m.meter_id)];
                            return (
                                <Chip key={m.meter_id}
                                    label={`${m.meter_name} · ${regName}`}
                                    size="small"
                                    onClick={() => toggleMeter(m.meter_id)}
                                    sx={{
                                        fontSize: 11, height: 24,
                                        backgroundColor: hidden ? "transparent" : `${color}22`,
                                        color:           hidden ? "text.secondary" : color,
                                        border:          `1px solid ${color}`,
                                        opacity:         hidden ? 0.4 : 1,
                                        cursor: "pointer", transition: "opacity 0.2s",
                                    }}
                                />
                            );
                        })}
                    </Box>
                )}
            </Box>
        </Dialog>
    );
}

// ── Widget Card ────────────────────────────────────────────────────────────────

function WidgetCard({ widget, meters, onEdit, onDeleteRequest, onDateChange, onZoom, dragHandleProps }) {
    const theme = useTheme();

    const activeMeters = useMemo(
        () => meters.filter(m => widget.meterRegisterMap?.[String(m.meter_id)]),
        [meters, widget.meterRegisterMap]
    );

    const [chartData,    setChartData]    = useState([]);
    const [unit,         setUnit]         = useState("");
    const [loading,      setLoading]      = useState(true);
    const [hiddenMeters, setHiddenMeters] = useState([]);
    const [widgetDate,   setWidgetDate]   = useState(
        widget.selectedDate ? dayjs(widget.selectedDate) : dayjs()
    );

    const isToday  = widgetDate.isSame(dayjs(), "day");
    const colorMap = widget.meterColorMap ?? {};

    const fetchData = useCallback(async () => {
        if (activeMeters.length === 0) { setLoading(false); return; }
        setLoading(true);
        const dateParam   = `&date=${widgetDate.format("YYYY-MM-DD")}`;
        const seriesMap   = {};
        let   detectedUnit = "";

        await Promise.all(
            activeMeters.map(async m => {
                const registerName = widget.meterRegisterMap[String(m.meter_id)];
                const records = await getData(
                    `/solardb/get-register-history/?meter_id=${m.meter_id}` +
                    `&register_name=${encodeURIComponent(registerName)}${dateParam}`
                );
                if (Array.isArray(records) && records.length > 0) {
                    if (!detectedUnit && records[0].unit && records[0].unit !== "--")
                        detectedUnit = records[0].unit;
                    seriesMap[m.meter_id] = records.map(r => ({
                        time:  typeof r.received_at === "string" ? r.received_at.substring(11, 16) : "--",
                        value: typeof r.value === "number" ? r.value : null,
                    }));
                }
            })
        );
        setUnit(detectedUnit);
        setChartData(mergeTimeSeries(seriesMap));
        setLoading(false);
    }, [activeMeters, widget.meterRegisterMap, widgetDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (!isToday || activeMeters.length === 0 || loading) return;
        const token   = sessionStorage.getItem("token");
        const sockets = activeMeters.map(m => {
            const registerName = widget.meterRegisterMap[String(m.meter_id)];
            const ws = new WebSocket(`${WS_BASE}/ws/meter_register/${m.meter_id}/?token=${token}`);
            ws.onmessage = (e) => {
                try {
                    const records = JSON.parse(e.data);
                    const match   = records.find(r => r.parameter_name === registerName);
                    if (!match || match.value == null) return;
                    const time  = typeof match.timestamp === "string" ? match.timestamp.substring(11, 16) : "--";
                    const value = typeof match.value === "number" ? match.value : null;
                    const key   = `m_${m.meter_id}`;
                    if (match.unit && match.unit !== "--") setUnit(u => u || match.unit);
                    setChartData(prev => {
                        const idx = prev.findIndex(pt => pt.time === time);
                        if (idx >= 0) { const u = [...prev]; u[idx] = { ...u[idx], [key]: value }; return u; }
                        return [...prev, { time, [key]: value }];
                    });
                } catch (_) {}
            };
            return ws;
        });
        return () => sockets.forEach(ws => ws.close());
    }, [isToday, activeMeters, widget.meterRegisterMap, loading]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDateChange = (v) => {
        if (!v) return;
        setWidgetDate(v);
        onDateChange(widget.id, v.format("YYYY-MM-DD"));
    };

    const toggleMeter = mid =>
        setHiddenMeters(prev => prev.includes(mid) ? prev.filter(x => x !== mid) : [...prev, mid]);

    const visibleMeters = activeMeters.filter(m => !hiddenMeters.includes(m.meter_id));

    return (
        <Box sx={{
            display: "flex", flexDirection: "column", height: "100%",
            backgroundColor: (t) => t.palette.background.head_box,
            borderRadius: 1, overflow: "hidden",
            transition: "box-shadow 0.15s",
            "&:hover": { boxShadow: "0 0 0 1.5px rgba(128,128,128,0.35)" },
        }}>

            {/* Row 1: drag + label + live dot + buttons */}
            <Box sx={{ display: "flex", alignItems: "center", px: 0.5, pt: 0.5, pb: 0, gap: 0.25 }}>
                <Tooltip title="Drag to reorder" placement="top">
                    <Box {...dragHandleProps} sx={{
                        display: "flex", alignItems: "center", cursor: "grab",
                        px: 0.5, color: "text.disabled", flexShrink: 0,
                        "&:active": { cursor: "grabbing" },
                    }}>
                        <DragIndicatorIcon sx={{ fontSize: 16 }} />
                    </Box>
                </Tooltip>

                {/* Clicking label area opens zoom */}
                <Box onClick={() => onZoom(widget)}
                    sx={{ display: "flex", alignItems: "center", flex: 1, cursor: "pointer", minWidth: 0, mr: 0.5 }}>
                    <Typography variant="caption" fontWeight="bold" noWrap sx={{ flex: 1 }}>
                        {widget.label || "Widget"}
                        <Typography component="span" variant="caption" sx={{ ml: 1, opacity: 0.55 }}>
                            {CHART_TYPES.find(c => c.value === widget.chartType)?.label}
                        </Typography>
                    </Typography>
                </Box>

                {isToday && !loading && (
                    <Box sx={{
                        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                        backgroundColor: "#4caf50", mr: 0.25,
                        "@keyframes pulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.3 } },
                        animation: "pulse 1.8s ease-in-out infinite",
                    }} />
                )}

                <Tooltip title="Expand" placement="top">
                    <IconButton size="small" onClick={e => { e.stopPropagation(); onZoom(widget); }} sx={{ p: 0.5 }}>
                        <OpenInFullIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Edit widget" placement="top">
                    <IconButton size="small" onClick={e => { e.stopPropagation(); onEdit(widget); }} sx={{ p: 0.5 }}>
                        <EditIcon sx={{ fontSize: 17 }} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Delete widget" placement="top">
                    <IconButton size="small" onClick={e => { e.stopPropagation(); onDeleteRequest(widget.id, widget.label); }} sx={{ p: 0.5 }}>
                        <DeleteIcon sx={{ fontSize: 17, color: "#ef4444" }} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Row 2: date picker */}
            <Box sx={{ px: 1.5, pb: 0.5, borderBottom: "1px solid rgba(128,128,128,0.25)" }}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker value={widgetDate} onChange={handleDateChange} disableFuture
                        slotProps={{
                            textField: {
                                size: "small", variant: "standard",
                                sx: {
                                    width: 110,
                                    "& .MuiInput-input": { fontSize: 11, py: "2px" },
                                    "& .MuiInput-underline:before": { borderBottomColor: "rgba(128,128,128,0.35)" },
                                    "& .MuiInput-underline:hover:before": { borderBottomColor: (t) => t.palette.text?.header_option ?? "#cc9900" },
                                },
                            },
                            openPickerButton: { size: "small", sx: { p: 0.25 } },
                            openPickerIcon:   { sx: { fontSize: 14 } },
                        }}
                    />
                </LocalizationProvider>
            </Box>

            {/* Chart — clicking opens zoom */}
            <Box onClick={() => onZoom(widget)}
                sx={{ flex: 1, minHeight: 0, px: 1, pt: 0.5, pb: 0.5, cursor: "pointer" }}>
                {loading ? (
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : activeMeters.length === 0 ? (
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                        <Typography variant="caption" color="text.secondary">No meters configured</Typography>
                    </Box>
                ) : chartData.length === 0 ? (
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                        <Typography variant="caption" color="text.secondary">
                            No data for {widgetDate.format("DD/MM/YYYY")}
                        </Typography>
                    </Box>
                ) : (
                    <WidgetChart
                        chartType={widget.chartType}
                        data={chartData}
                        visibleMeters={visibleMeters}
                        allMeters={meters}
                        colorMap={colorMap}
                        unit={unit}
                    />
                )}
            </Box>

            {/* Meter legend */}
            {activeMeters.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, px: 1.5, py: 0.75, borderTop: "1px solid rgba(128,128,128,0.25)" }}>
                    {activeMeters.map(m => {
                        const hidden  = hiddenMeters.includes(m.meter_id);
                        const color   = getMeterColor(m, meters, colorMap);
                        const regName = widget.meterRegisterMap[String(m.meter_id)];
                        return (
                            <Chip key={m.meter_id}
                                label={`${m.meter_name} · ${regName}`}
                                size="small"
                                onClick={e => { e.stopPropagation(); toggleMeter(m.meter_id); }}
                                sx={{
                                    fontSize: 9, height: 20,
                                    backgroundColor: hidden ? "transparent" : `${color}22`,
                                    color:           hidden ? "text.secondary" : color,
                                    border:          `1px solid ${color}`,
                                    opacity:         hidden ? 0.4 : 1,
                                    cursor: "pointer", transition: "opacity 0.2s",
                                }}
                            />
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}

// ── Sortable wrapper ───────────────────────────────────────────────────────────

function SortableWidgetCard(props) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: props.widget.id });
    return (
        <Box ref={setNodeRef} sx={{
            transform: CSS.Transform.toString(transform), transition,
            opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 999 : "auto", height: "100%",
        }}>
            <WidgetCard {...props} dragHandleProps={{ ...attributes, ...listeners }} />
        </Box>
    );
}

// ── Dashboard Screen (per-site) ────────────────────────────────────────────────

function DashboardScreen({ site, onBack }) {
    const theme = useTheme();

    const [widgets,         setWidgets]         = useState([]);
    const [widgetsLoading,  setWidgetsLoading]  = useState(true);
    const [meters,          setMeters]          = useState([]);
    const [dialogOpen,      setDialogOpen]      = useState(false);
    const [editingWidget,   setEditingWidget]   = useState(null);
    const [zoomedWidget,    setZoomedWidget]    = useState(null);
    const [deleteTarget,    setDeleteTarget]    = useState(null); // { id, label }
    const [resetCounter,    setResetCounter]    = useState(0);
    const [calendarAnchor,  setCalendarAnchor]  = useState(null);
    const [calendarValue,   setCalendarValue]   = useState(dayjs());

    useEffect(() => {
        getData(`/solardb/dashboard-config/?site_id=${site.site_id}`).then(data => {
            if (data && Array.isArray(data.widgets)) setWidgets(data.widgets);
            setWidgetsLoading(false);
        });
    }, [site.site_id]);

    useEffect(() => {
        getData("/solardb/get-all-meters/").then(data => {
            if (Array.isArray(data))
                setMeters(data.filter(m => m.site_id === site.site_id));
        });
    }, [site.site_id]);

    const applyWidgets = newWidgets => {
        setWidgets(newWidgets);
        postData("/solardb/dashboard-config/save/", { site_id: site.site_id, widgets: newWidgets });
    };

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const handleDragEnd = ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const oldIndex = widgets.findIndex(w => w.id === active.id);
        const newIndex = widgets.findIndex(w => w.id === over.id);
        applyWidgets(arrayMove(widgets, oldIndex, newIndex));
    };

    const handleAddClick         = ()  => { setEditingWidget(null); setDialogOpen(true); };
    const handleEditClick        = w   => { setEditingWidget(w);    setDialogOpen(true); };
    const handleDeleteRequest    = (id, label) => setDeleteTarget({ id, label });
    const handleDeleteConfirm    = ()  => {
        if (deleteTarget) applyWidgets(widgets.filter(w => w.id !== deleteTarget.id));
        setDeleteTarget(null);
    };

    const handleDateChange = (widgetId, dateStr) =>
        applyWidgets(widgets.map(w => w.id === widgetId ? { ...w, selectedDate: dateStr } : w));

    const openCalendar  = e => setCalendarAnchor(e.currentTarget);
    const closeCalendar = () => setCalendarAnchor(null);

    const applyDateToAll = date => {
        if (!date) return;
        const dateStr = date.format("YYYY-MM-DD");
        applyWidgets(widgets.map(w => ({ ...w, selectedDate: dateStr })));
        setCalendarValue(date);
        setResetCounter(c => c + 1); // force widget cards to remount → re-init date state
        closeCalendar();
    };

    const handleJumpToToday = () => applyDateToAll(dayjs());

    const handleDialogSave = ({ label, chartType, meterRegisterMap, meterColorMap }) => {
        if (editingWidget) {
            applyWidgets(widgets.map(w =>
                w.id === editingWidget.id ? { ...w, label, chartType, meterRegisterMap, meterColorMap } : w
            ));
        } else {
            applyWidgets([...widgets, { id: Date.now().toString(), label, chartType, meterRegisterMap, meterColorMap }]);
        }
        setDialogOpen(false);
    };

    const cols = getGridCols(widgets.length);
    const rows = Math.ceil(widgets.length / cols) || 1;

    return (
        <Box sx={{ display: "flex", flexDirection: "column", height: "100%", p: 2, gap: 2, boxSizing: "border-box" }}>

            {/* Header */}
            <Box sx={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                backgroundColor: theme.palette.background.head_box,
                px: 2, py: 1, borderRadius: 1, flexShrink: 0,
            }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Tooltip title="Back to site selection">
                        <IconButton size="small" onClick={onBack}
                                    sx={{ color: theme.palette.text.header_option }}>
                            <ArrowBackIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Typography variant="h6" fontSize={15} fontWeight="bold">Dashboard</Typography>
                    <Typography fontSize={13} color="text.secondary" sx={{ ml: 0.5 }}>
                        — {site.site_name}
                    </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Tooltip title="Jump all widgets to a specific date">
                        <span>
                            <Button size="small" variant="outlined" startIcon={<EventIcon />}
                                onClick={openCalendar} disabled={widgets.length === 0}
                                sx={{
                                    color: theme.palette.text.header_option,
                                    borderColor: theme.palette.text.header_option,
                                    fontSize: 12,
                                    "&:hover": { backgroundColor: "rgba(128,128,128,0.08)" },
                                }}>
                                Jump to Date
                            </Button>
                        </span>
                    </Tooltip>
                    <Popover
                        open={Boolean(calendarAnchor)} anchorEl={calendarAnchor} onClose={closeCalendar}
                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                        transformOrigin={{ vertical: "top", horizontal: "right" }}
                    >
                        <Box sx={{ display: "flex", justifyContent: "flex-end", px: 1, pt: 1 }}>
                            <Button size="small" startIcon={<TodayIcon fontSize="small" />}
                                onClick={handleJumpToToday} sx={{ fontSize: 12 }}>
                                Today
                            </Button>
                        </Box>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DateCalendar value={calendarValue} onChange={applyDateToAll} disableFuture />
                        </LocalizationProvider>
                    </Popover>
                    <Tooltip title={widgets.length >= MAX_WIDGETS ? `Maximum ${MAX_WIDGETS} widgets reached` : "Add a new widget"}>
                        <span>
                            <Button size="small" variant="outlined" startIcon={<AddIcon />}
                                onClick={handleAddClick} disabled={widgets.length >= MAX_WIDGETS}
                                sx={{
                                    color: theme.palette.text.header_option,
                                    borderColor: theme.palette.text.header_option,
                                    fontSize: 12,
                                    "&:hover": { backgroundColor: "rgba(128,128,128,0.08)" },
                                }}>
                                Add Widget ({widgets.length}/{MAX_WIDGETS})
                            </Button>
                        </span>
                    </Tooltip>
                </Box>
            </Box>

            {/* Content */}
            {widgetsLoading ? (
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CircularProgress size={32} />
                </Box>
            ) : widgets.length === 0 ? (
                <Box sx={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                    justifyContent: "center", backgroundColor: theme.palette.background.head_box,
                    borderRadius: 1, gap: 2,
                }}>
                    <Typography color="text.secondary" fontSize={14}>No widgets yet. Add your first widget!</Typography>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddClick}>Add Widget</Button>
                </Box>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={widgets.map(w => w.id)} strategy={rectSortingStrategy}>
                        <Box sx={{
                            flex: 1, minHeight: 0, display: "grid",
                            gridTemplateColumns: `repeat(${cols}, 1fr)`,
                            gridTemplateRows:    `repeat(${rows}, 1fr)`,
                            gap: 2,
                        }}>
                            {widgets.map(widget => (
                                <SortableWidgetCard
                                    key={`${widget.id}-${resetCounter}`} widget={widget} meters={meters}
                                    onEdit={handleEditClick}
                                    onDeleteRequest={handleDeleteRequest}
                                    onDateChange={handleDateChange}
                                    onZoom={setZoomedWidget}
                                />
                            ))}
                        </Box>
                    </SortableContext>
                </DndContext>
            )}

            <AddEditDialog
                open={dialogOpen} meters={meters} initialWidget={editingWidget}
                onSave={handleDialogSave} onClose={() => setDialogOpen(false)}
            />

            <WidgetZoomDialog
                open={!!zoomedWidget} widget={zoomedWidget} meters={meters}
                onClose={() => setZoomedWidget(null)}
            />

            <DeleteConfirmDialog
                open={!!deleteTarget}
                widgetLabel={deleteTarget?.label}
                onConfirm={handleDeleteConfirm}
                onClose={() => setDeleteTarget(null)}
            />
        </Box>
    );
}

// ── Root ───────────────────────────────────────────────────────────────────────

export default function ChartingTool() {
    const [selectedSite, setSelectedSite] = useState(null);
    if (selectedSite) {
        return <DashboardScreen site={selectedSite} onBack={() => setSelectedSite(null)} />;
    }
    return <SiteSelectScreen onSelect={setSelectedSite} />;
}
