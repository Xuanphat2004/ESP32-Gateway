import { Box, sizeHeight } from "@mui/system";
import Tooltip from "@mui/material/Tooltip";
import StringToolTip from "../InteractComponent/Tooltip";
import { useTheme } from "@mui/material/styles";
import { use } from "react";

function StringTable({ stringname, stringlist }) {
    const theme = useTheme();
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        width: "100%",
        height: "100%",
        borderTopLeftRadius: 10,
        overflow: "hidden"
      }}
    >
      {/* <StringToolTip> */}
        <Box
          sx={{
            flex: 0.7,
            paddingRight: "3px",
            backgroundColor: theme.palette.background.head_string,
            backgroundClip: "content-box",
            color: "white",
            height: "50px",
            textAlign: "center",
            fontSize: "18px",
            
          }}
        >

            {stringname}
        </Box>
      {/* </StringToolTip> */}

      <Box
        sx={{
          flex: "3",
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          alignContent: "flex-start",
        }}
      >
        {stringlist.map((item, index) => {
          const order = Object.keys(item)[0];
          const value = item[order];
          return (
            <Box
              key={index}
              sx={{
                flex: "1 0 calc(33% - 16px)",
                maxWidth: "calc(20% - 16px)",
                maxWidth: "100px",
                height: "50px",
                padding: "1px",
                backgroundColor: theme.palette.background.string,
                backgroundClip: "content-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
              }}
            >
              <Box
                sx={{
                  flex: 1,
                }}
              >
                {order}
              </Box>
              <Box
                sx={{
                  flex: 1,
                }}
              >
                {value}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default StringTable;
