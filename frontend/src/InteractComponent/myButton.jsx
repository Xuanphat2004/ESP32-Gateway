// import { Button } from "@mui/material";
// import { useTheme } from "@mui/material/styles";

// const MyButton = ({label, sx ={}, ...rest}) => {
//   const theme = useTheme();
//   return (
//     <Button
//       variant="outlined"
//       sx={{
//         color: theme.palette.text.header_option,
//         borderColor: theme.palette.text.header_option,
//         ...sx,
//       }}
//     >
//       {...rest}
//       {label}
//     </Button>
//   );
// };

// export default MyButton;

import { Button } from "@mui/material";
import { useTheme } from "@mui/material/styles";

const   MyButton = ({ label, sx = {}, ...rest }) => {
  const theme = useTheme();

  return (
    <Button
      variant="outlined"
      size="small"
      sx={{
        color: theme.palette.text.header_option,
        borderColor: theme.palette.text.header_option,
        ...sx, // Ghi đè ở đây
      }}
      {...rest} // truyền các props khác như onClick, className,...
    >
      {label} 
    </Button>
  );
};

export default MyButton;
