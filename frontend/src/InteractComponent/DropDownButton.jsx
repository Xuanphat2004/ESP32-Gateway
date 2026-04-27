import { useTheme } from "@mui/material/styles";
import { Select, MenuItem, FormControl, OutlinedInput } from "@mui/material";

function DropDownButton({ options, onChange, pick }) {
  let theme = useTheme();

  const handleChange = (event) => {
    onChange(event.target.value);
  };

  return (
    <Select
      value={pick}
      onChange={handleChange}
      sx={{
        width: "150px",
        height: "30px",
        background: theme.palette.background.default,
        color: theme.palette.text.header_option,
        "& .MuiSelect-icon": {
          color: theme.palette.text.header_option,
        },
        "& fieldset": {
          borderColor: theme.palette.text.header_option,
        },
        "&:hover fieldset": {
          borderColor: theme.palette.text.option,
        },
        "&.Mui-focused fieldset": {
          borderColor: theme.palette.text.option,
        },
      }}
      MenuProps={{
        PaperProps: {
          sx: {
            color: theme.palette.text.header_option,
            borderColor: theme.palette.text.header_option,
          },
        },
      }}
      input={
        <OutlinedInput
          sx={{
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: theme.palette.text.header_option, // màu viền bình thường
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: theme.palette.text.header_option, // màu viền khi hover
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: theme.palette.text.header_option, // màu viền khi focus
            },
          }}
        />
      }
    >
      {options.map((item) => (
        <MenuItem
          key={item}
          value={item}
          sx={{
            color: theme.palette.text.header_option,
            borderColor: theme.palette.text.header_option,
          }}
        >
          {item}
        </MenuItem>
      ))}
    </Select>
  );
}

export default DropDownButton;
