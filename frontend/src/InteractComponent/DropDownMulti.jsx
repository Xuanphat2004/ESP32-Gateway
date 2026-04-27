import React, { useState } from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  TextField,
  Collapse,
  List,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { ExpandLess, ExpandMore } from '@mui/icons-material';

function MultiSelectDropdown({ label, options, value, onChange }) {
  const [search, setSearch] = useState("");
  const theme = useTheme();

  const handleChange = (event) => {
    const { target: { value: newValue } } = event;
    if (newValue.includes("Select All")) {
      // Nếu chọn "Select All", chọn tất cả các mục trong options
      onChange(options.filter(option => option !== "Select All"));
    } else {
      // Loại bỏ "Select All" nếu có và cập nhật các giá trị đã chọn
      const updatedValue = typeof newValue === 'string' ? newValue.split(',') : newValue;
      onChange(updatedValue.filter(item => item !== "Select All"));
    }
  };

  const isAllSelected = options.length > 1 && options.every(option => option === "Select All" || value.includes(option));

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <FormControl variant="outlined" sx={{ width: "100%", height: "30px", }}>
      {/* <InputLabel
        sx={{
          color: "white",
          "&.Mui-focused": {  
            color: theme.palette.text.option,
          },
          top: "-12px",
        }}
      >
        {label}
      </InputLabel> */}
      {/* <InputLabel id="filter-label">Add Filter(s)</InputLabel> */}
      <Select
        // labelId="filter-label"
        multiple
        displayEmpty
        // label={label}
        value={value}
        onChange={handleChange}
        renderValue={(selected) => {
          if (selected.length === 0) {
            return <span style={{ color: "grey"}}>{label}</span>;
          }
          return selected.join(", ");
        }}
        MenuProps={{
          PaperProps: {
            sx: { 
              maxHeight: 300,
              background: theme.palette.background.paper,
              color: theme.palette.text.header_option,
              overflow: "auto",
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'transparent',
                borderRadius: '4px',
              },
              '&:hover::-webkit-scrollbar-thumb': {
                backgroundColor: theme.palette.background.head_box,
              },
              '&:hover::-webkit-scrollbar-track': {
                backgroundColor: 'transparent',
              },
            },
          },
        }}
        sx={{
          height: "30px",
          background: theme.palette.background.default,
          // backgroundColor: "red",
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
      >
        <MenuItem disableRipple>
          <TextField
            autoFocus
            size="small"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            sx={{
              "& .MuiInputBase-root": {
                color: theme.palette.text.header_option,
              },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: theme.palette.text.header_option,
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: theme.palette.text.option,
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: theme.palette.text.option,
              },
            }}
          />
        </MenuItem>

        <MenuItem disabled divider />

        {options.includes("Select All") && (
          <MenuItem
            value="Select All"
            sx={{
              "&.Mui-selected": {
                backgroundColor: theme.palette.action.selected,
                "&:hover": {
                  backgroundColor: theme.palette.action.hover,
                },
              },
            }}
          >
            <Checkbox
              checked={isAllSelected}
              onChange={(e) => {
                if (e.target.checked) {
                  onChange(options.filter(option => option !== "Select All"));
                } else {
                  onChange([]);
                }
              }}
              sx={{
                color: theme.palette.text.header_option,
                "&.Mui-checked": {
                  color: theme.palette.text.option,
                },
              }}
            />
            <ListItemText
              primary="Select All"
              sx={{ color: theme.palette.text.header_option }}
            />
          </MenuItem>
        )}

        {filteredOptions
        .filter(option => option !== "Select All")
        .map((option) => (
          <MenuItem key={option} value={option}>
            <Checkbox
              checked={value.indexOf(option) > -1}
              sx={{
                color: theme.palette.text.header_option,
                "&.Mui-checked": {
                  color: theme.palette.text.option,
                },
              }}
            />
            <ListItemText
              primary={option}
              sx={{ color: theme.palette.text.header_option }}
            />
          </MenuItem>
        ))}

        {filteredOptions.length === 0 && (
          <MenuItem disabled>No results</MenuItem>
        )}
      </Select>
    </FormControl>
  );
}

function AllCategoriesDropDown ({ label, options, value, onChange }) {
  const theme = useTheme();
  // const [value, setValue] = useState([]);
  const [search, setSearch] = useState('');
  const [openSubMenu, setOpenSubMenu] = useState({});
  const parentOptions = Object.keys(options);

  const handleChange = (event) => {
    const { target: { value: newValue } } = event;
    const selectedOption = event.target.value;

    if (newValue.includes(selectedOption)) {
      // Nếu chọn parent (Device Alarm hoặc Performance Alarm)
      const subOptions = getSubOptions(selectedOption);
      if (subOptions.length > 0) {
        onChange([...new Set([...value, selectedOption, ...subOptions])]);
      } else {
        onChange([...new Set([...value, selectedOption])]);
      }
    } else {
      // Nếu bỏ chọn parent
      const subOptions = getSubOptions(selectedOption);
      if (subOptions.length > 0) {
        onChange(value.filter(item => item !== selectedOption && !subOptions.includes(item)));
      } else {
        onChange(value.filter(item => item !== selectedOption));
      }
    }
  };

  const handleSubMenuToggle = (option) => {
    setOpenSubMenu(prev => ({ ...prev, [option]: !prev[option] }));
  };

  const filteredOptions = parentOptions.filter(option =>
    option.toLowerCase().includes(search.toLowerCase())
  );

  const getSubOptions = (option) => {
    return options[option] || [];
  };

  return (
    <FormControl sx={{ width: "100%", height: "30px", }}>
      {/* <InputLabel
        sx={{
          color: "white",
          "&.Mui-focused": {
            color: theme.palette.text.option,
          },
        }}
      >
        {label}
      </InputLabel> */}
      <Select
        multiple
        displayEmpty
        // label={label}
        value={value}
        onChange={handleChange}
        renderValue={(selected) => {
          if (selected.length === 0) {
            return <span style={{ color: "grey"}}>{label}</span>;
          }
          return selected.join(", ");
        }}
        MenuProps={{
          PaperProps: {
            sx: { 
              maxHeight: 300,
              background: theme.palette.background.paper,
              color: theme.palette.text.header_option,
              overflow: "auto",

              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'transparent',
                borderRadius: '4px',
              },

              '&:hover::-webkit-scrollbar-thumb': {
                backgroundColor: theme.palette.background.head_box,
              },
              '&:hover::-webkit-scrollbar-track': {
                backgroundColor: 'transparent',
              },
            },
          },
        }}
        sx={{
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
      >
        <MenuItem disableRipple>
          <TextField
            autoFocus
            size="small"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            sx={{
              "& .MuiInputBase-root": {
                color: theme.palette.text.header_option,
              },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: theme.palette.text.header_option,
              },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: theme.palette.text.option,
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: theme.palette.text.option,
              },
            }}
          />
        </MenuItem>

        <MenuItem disabled divider />

        {filteredOptions.map((option) => {
          const subOptions = getSubOptions(option);
          return (
            <div key={option}>
              <MenuItem onClick={() => handleSubMenuToggle(option)}>
                <Checkbox
                  checked={subOptions.length > 0 ? subOptions.every(sub => value.includes(sub)) : value.includes(option)}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    if (subOptions.length > 0) {
                      onChange(isChecked ? [...new Set([...value, option, ...subOptions])] : value.filter(item => !subOptions.includes(item) && item !== option));
                    } else {
                      onChange(isChecked ? [...value, option] : value.filter(item => item !== option));
                    }
                  }}
                  sx={{
                    color: theme.palette.text.header_option,
                    "&.Mui-checked": {
                      color: theme.palette.text.option,
                    },
                  }}
                />
                <ListItemText
                  primary={option}
                  sx={{ color: theme.palette.text.header_option, }}
                />
                {subOptions.length > 0 && (openSubMenu[option] ? <ExpandLess /> : <ExpandMore />)}
              </MenuItem>
              {subOptions.length > 0 && (
                <Collapse in={openSubMenu[option]} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {subOptions.map((subOption) => (
                      <MenuItem
                        key={subOption}
                        value={subOption}
                        sx={{ pl: 4 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={value.includes(subOption)}
                          onChange={(e) => {
                            const isChecked = e.target.checked;
                            onChange(isChecked ? [...value, subOption] : value.filter(item => item !== subOption));
                          }}
                          sx={{
                            color: theme.palette.text.header_option,
                            "&.Mui-checked": {
                              color: theme.palette.text.option,
                            },
                          }}
                        />
                        <ListItemText
                          primary={subOption}
                          sx={{ color: theme.palette.text.header_option, }}
                        />
                      </MenuItem>
                    ))}
                  </List>
                </Collapse>
              )}
            </div>
          );
        })}

        {filteredOptions.length === 0 && (
          <MenuItem disabled>No records available</MenuItem>
        )}
      </Select>
    </FormControl>
  );
};

export {MultiSelectDropdown, AllCategoriesDropDown};