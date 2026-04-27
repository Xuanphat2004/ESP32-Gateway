import { useState, useRef, useEffect } from 'react';
import { DateRange } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { useTheme } from "@mui/material/styles";

export default function MySmartRangePicker({ value, onChange }) {
  const theme = useTheme();
  const containerRef = useRef(null);

  const [state, setState] = useState([
    {
      startDate: new Date(),
      endDate: new Date(),
      key: 'selection'
    }
  ]);
  const [open, setOpen] = useState(false);
  const [whichInput, setWhichInput] = useState(null);

  useEffect(() => {
    if (value && JSON.stringify(value) !== JSON.stringify(state)) {
      setState(value);
    }
  }, [value]);

  const formatDate = (date) =>
    date ? date.toLocaleDateString('en-GB') : '__/__/____';

  const handleDateChange = (item) => {
    const newRange = item.selection;
    if (whichInput === 'start') {
      setState([{ ...state[0], startDate: newRange.startDate }]);
    } else if (whichInput === 'end') {
      setState([{ ...state[0], endDate: newRange.endDate }]);
    } else {
      setState([newRange]);
    }
  };

  // Đóng calendar khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setWhichInput(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          border: `1px solid ${theme.palette.text.header_option}`,
          borderRadius: '4px',
          padding: '6px 12px',
          width: 'fit-content',
          height: '30px',
          background: theme.palette.background.default,
        }}
      >
        <span
          onClick={() => {
            setOpen(true);
            setWhichInput('start');
          }}
          style={{
            marginRight: '8px',
            cursor: 'pointer',
            borderBottom: whichInput === 'start' ? `2px solid ${theme.palette.text.option}` : 'none',
            color: theme.palette.text.header_option,
            fontSize: '0.875rem'
          }}
        >
          {formatDate(state[0].startDate)}
        </span>
        <span style={{ color: theme.palette.text.header_option }}>-</span>
        <span
          onClick={() => {
            setOpen(true);
            setWhichInput('end');
          }}
          style={{
            marginLeft: '8px',
            cursor: 'pointer',
            borderBottom: whichInput === 'end' ? `2px solid ${theme.palette.text.option}` : 'none',
            color: theme.palette.text.header_option,
            fontSize: '0.875rem'
          }}
        >
          {formatDate(state[0].endDate)}
        </span>

        <CalendarMonthIcon
          onClick={() => {
            setOpen(prev => {
              const newOpen = !prev;
              if (!newOpen) setWhichInput(null);
              return newOpen;
            });
          }}
          sx={{
            fontSize: "18px",
            marginLeft: '12px',
            cursor: 'pointer',
            fill: theme.palette.text.header_option,
            "&:hover": {
              fill: theme.palette.text.option
            }
          }}
        />
      </div>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 1000,
            marginTop: '4px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            background: theme.palette.background.paper,
            borderRadius: '8px',
          }}
        >
          <DateRange
            showDateDisplay={false}
            editableDateInputs={true}
            onChange={handleDateChange}
            moveRangeOnFirstSelection={false}
            ranges={state}
          />
        </div>
      )}
    </div>
  );
}
