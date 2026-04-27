import { CSVLink, CSVDownload } from "react-csv";
import SaveAltIcon from "@mui/icons-material/SaveAlt";
import { styled } from "@mui/material/styles";
import { useTheme } from "@mui/material/styles";


export default function DownLoadCSV({ data, filename }) {
    let theme =useTheme();
  const StyledCSVLink = styled(CSVLink)(({ theme }) => ({
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 16px",
    borderRadius: "4px",
    backgroundColor: theme.palette.background.button,
    color: theme.palette.text.body_chart,
    textDecoration: "none",
    "&:hover": {
      backgroundColor: theme.palette.text.header_option
    },
  }));
  return (
    <div>
      <StyledCSVLink data={data} filename={filename}>
        <SaveAltIcon />
      </StyledCSVLink>
    </div>
  );
}
