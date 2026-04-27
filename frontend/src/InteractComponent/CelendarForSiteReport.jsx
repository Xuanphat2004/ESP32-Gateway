import { useEffect, useState, useMemo } from "react";
import { Box, Typography, Button } from "@mui/material";
import DropDownButton from "./DropDownButton";
import { DefaultLegendContent } from "recharts";
import MySmartRangePicker from "./DataRangePicker";

function CelendarForSiteReport({frequency}) {
    const timeRangeOptions = {
        "Daily": ["Yesterday", "Last 3 Days", "Last 7 Days", "Last 30 Days"],
        "Weekly": ["Last Week", "Last 2 Weeks", "Last 4 Weeks"],
        "Monthly": ["Last Month", "Last 3 Months", "Last 6 Months", "Last 12 Months"],
        "Quarterly": ["Last 1 Quarter", "Last 2 Quarters", "Last 4 Quarters"],
        "Yearly": ["Last Year", "Last 3 Years"],
        "Accumulated": [],
    }

    const [timeRange, setTimeRange] = useState([
        {
            startDate: new Date(),
            endDate: new Date(),
            key: "selection",
        }
    ]);
    const { currentOptions, defaultQuickTime } = useMemo(() => {
        const options = timeRangeOptions[frequency] || [];
        return {
            currentOptions: options,
            defaultQuickTime: options[0] || ""
        };
    }, [frequency]);
    
    const [quickTime, setQuickTime] = useState(defaultQuickTime);

    // Cập nhật quickTime khi frequency thay đổi
    useEffect(() => {
        setQuickTime(defaultQuickTime);
    }, [defaultQuickTime]);

    useEffect(() => {
        if (!quickTime) return;
        let endDate = new Date(); // Ngày hiện tại hoặc endDate từ state
        let startDate = new Date();
        if (frequency === "Daily") {
            switch (quickTime) {
                case "Today":
                    startDate.setDate(endDate.getDate());
                    break;
                case "Last 3 Days":
                    startDate.setDate(endDate.getDate() - 3);
                    break;
                case "Last 7 Days":
                    startDate.setDate(endDate.getDate() - 7);
                    break;
                case "Last 30 Days":
                    startDate.setDate(endDate.getDate() - 30);
                    break;
                default:
                    break;
            }
        }
        else if (frequency === "Weekly") {
            const currentDay = endDate.getDay(); // 0 (Chủ nhật) đến 6 (Thứ bảy)
            // Nếu là Chủ nhật thì xử lý như 7 để tính toán đúng
            const daysSinceThisMonday = (currentDay === 0 ? 6 : currentDay) - 1;
            // Tính ngày đầu tuần này (Thứ 2)
            const dateOfMondayThisWeek = endDate.getDate() - daysSinceThisMonday;
            endDate.setDate(dateOfMondayThisWeek - 1);
            switch (quickTime) {
                case "Last Week":
                    startDate.setDate(dateOfMondayThisWeek - 7);
                    break;
                case "Last 2 Weeks":
                    startDate.setDate(dateOfMondayThisWeek - 14);
                    break;
                case "Last 4 Weeks":
                    startDate.setDate(dateOfMondayThisWeek - 28);
                    break;
                default:
                    break;
            }
        }
        else if (frequency === "Monthly") {
            switch (quickTime) {
                case "Last Month":
                    startDate.setMonth(endDate.getMonth() - 1);
                    break;
                case "Last 3 Months":
                    startDate.setMonth(endDate.getMonth() - 3);
                    break;
                case "Last 6 Months":
                    startDate.setMonth(endDate.getMonth() - 6);
                    break;
                case "Last 12 Months":
                    startDate.setMonth(endDate.getMonth() - 12);
                    break;
                default:
                    break;
            }
        }
        else if (frequency === "Quarterly") {
            switch (quickTime) {
                case "Last Quarter":
                    startDate.setMonth(endDate.getMonth() - 3);
                    break;
                case "Last 2 Quarters":
                    startDate.setMonth(endDate.getMonth() - 6);
                    break;
                case "Last 4 Quarters":
                    startDate.setMonth(endDate.getMonth() - 12);
                    break;
                default:
                    break;
            }
        }
        else {
            switch (quickTime) {
                case "Last Year":
                    startDate.setFullYear(endDate.getFullYear() - 1);
                    break;
                case "Last 3 Years":
                    startDate.setFullYear(endDate.getFullYear() - 3);
                    break;
                default:
                    break;
            }
        }
        setTimeRange([
            {
                startDate: startDate,
                endDate: endDate,
                key: "selection",
            },
        ]);
        
    }, [quickTime]);
    const safeQuickTime = currentOptions.includes(quickTime) ? quickTime : defaultQuickTime;

    return (
        <Box sx={{ width: "100%", height: "30px", display: "flex" }}>
            <DropDownButton options={currentOptions} onChange={setQuickTime} pick={safeQuickTime}/>
            <MySmartRangePicker value={timeRange} onChange={(newValue) => setTimeRange(newValue)}/>
        </Box>
    );
}

export default CelendarForSiteReport;