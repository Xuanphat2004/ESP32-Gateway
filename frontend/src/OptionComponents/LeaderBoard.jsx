import { Button, Stack } from "@mui/material";
import MyBarChart from "../ChartComponents/BarChart";
import MyLineChart from "../ChartComponents/LineChart2";
import InverterRanking from "../DataComponents/InverterRanking";
import { useState, useEffect } from "react";
import { Bar } from "react-chartjs-2";
import axios from "axios";
import { DatePicker } from "@mui/x-date-pickers/DatePicker"; // table to choose calendar
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"; // support datepicker to know: which lib?, format data?...
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs"; // “bộ chuyển đổi” để MUI hiểu được thư viện Day.js mà bạn đang dùng.
import dayjs from "dayjs"; // lib datetime using
import MyButton from "../InteractComponent/myButton";
import MyCalendar from "../InteractComponent/myCalendar";
import { alignContent, alignItems, Box, sizeHeight } from "@mui/system";
import { ThemeContext } from "@emotion/react";
import { useTheme } from "@mui/material/styles";
import PowerIcon from "@mui/icons-material/Power";
import { DiBackbone } from "react-icons/di";
import { PiPlugChargingBold } from "react-icons/pi";
import { GiCharging } from "react-icons/gi";
import LocationPinIcon from "@mui/icons-material/LocationPin";
import Typography from "@mui/material/Typography";
import { Link } from "react-router-dom";
import CombinedChart from "../ChartComponents/CombineChart";
import SingleBarChart from "../ChartComponents/SingleBar";
import { Select, MenuItem, FormControl, InputLabel, Chip, } from "@mui/material";

function LeaderBoard() {
  let theme = useTheme();
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        // justifyContent: "space-around",
        padding: 2,
        gap: 2,
      }}
    >
      {/*Header*/}
      <Box
        sx={{
          flex: "2",
          // backgroundColor: theme.palette.background.head_box,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          // justifyContent: "space-around",
          boxShadow: "0 4px 6px rgba(19, 16, 16, 0.1)",
          padding: "2px",
          gap: 2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body1" color="white" paddingLeft="15px">
            Select Site:
          </Typography>
          <FormControl size="small" sx={{minWidth: 200,}}>
            <InputLabel id="dropdown-label">TotalEnergies</InputLabel>
            <Select>
              <MenuItem value="TotalEnergies (1)">TotalEnergies (1)</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            sx={{
              backgroundColor: "#00bcd4",
              color: "white",
              "&:hover": {
                backgroundColor: "#0097a7",
              },
            }}
          >
            Search
          </Button>
        </Box>
        {/* <Box
          sx={{
            flex: 1,
          }}
        >
          Select Site
        </Box> */}
        {/* <Box>
          <MyCalendar mode="year" />
        </Box> */}
      </Box>
      
      {/* Production Budget Completion Rate Section */}
      <Box
        sx={{
          flex: "8",
          boxShadow: "0 4px 6px rgba(19, 16, 16, 0.1)",
        }}
      >
        {/*Header*/}
        <Box sx={{
          flexDirection: "row",
          flex: "2",
          display: "flex",
          justifyContent: "space-between",
          backgroundColor: theme.palette.background.head_box,
        }}>
          <Box
            style={{
              // backgroundColor: theme.palette.background.head_box
              alignContent: "center",
              paddingLeft: "17px",
            }}
          >
            Production Budget Completion Rate
          </Box>
          <Box sx={{
            paddingRight: "17px",
            paddingTop: "4px",
            paddingBottom: "4px",
          }}>
            <MyCalendar mode="year" />
          </Box>
        </Box>
        {/*Content*/}
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            backgroundColor: theme.palette.background.box,
          }}
        >
          {/*Left Sidebar */}
          <Box
            sx={{
              flex: 3,
              // paddingRight: 2,
              borderRight: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Box
              sx={{ 
                marginBottom: 2,
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                // backgroundColor: "orange",
                padding: "5px",
              }}
            >
              <Typography variant="body1" fontSize={14} color="white" flex={1} paddingLeft="12px">
                Total: 53%
              </Typography>
              <Typography variant="body2" fontSize={14} color="#00bcd4" flex={1}>
                Details
              </Typography>
              <Typography variant="body2" fontSize={14} color="white" align="right" flex={2} paddingRight="12px">
                Completion Rate
              </Typography>
            </Box>
            
            <Box
              sx={{
                marginBottom: 2,
                // backgroundColor: "skyblue",
                display: "flex",
                padding: "5px",
              }}
            >
              <Typography variant="body2" fontSize={14} color="white" flex={1} paddingLeft= "12px">
                1. Bach Khoa
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box
                  sx={{
                    width: "200px",
                    height: "8px",
                    backgroundColor: "#333",
                    borderRadius: 1,
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      width: "53%",
                      height: "100%",
                      backgroundColor: "#00bcd4",
                    }}
                  />
                </Box>
                <Typography variant="body2" fontSize={14} color="white" paddingRight="12px">
                  53%
                </Typography>
              </Box>
            </Box>
          </Box>
          {/*Chart*/}
          <Box
            sx={{
              flex: 8,
              height: "360px"
            }}
          >
            <CombinedChart />
          </Box>
        </Box>
      </Box>
      <Box
        sx={{
          flex: "8",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 6px rgba(19, 16, 16, 0.1)",
        }}
      >
        <Box
          sx={{
            flex: "1",
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            minHeight: "100%",
            backgroundColor: theme.palette.background.head_box,
            alignItems: "center",
          }}
        >
          <Box paddingLeft="17px">Performance Ranking</Box>
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <div
              style={{
                marginRight: "15px",
              }}
            >
              <MyButton label={"Yield"} />
              <MyButton label={"PR"} />
            </div>
            <div
              style={{
                marginRight: "15px",
              }}
            >
              <MyButton label={"Day"} />
              <MyButton label={"Month"} />
              <MyButton label={"Year"} />
              <MyButton label={"Total"} />
            </div>
            <div>
              <MyCalendar mode={"month"} />
            </div>
          </Box>
        </Box>
        <Box
          sx={{
            flex: "7",
            width: "100%",
            backgroundColor: theme.palette.background.box,
          }}
        >
          <SingleBarChart />
        </Box>
      </Box>
    </Box>
  );
}

export default LeaderBoard;
