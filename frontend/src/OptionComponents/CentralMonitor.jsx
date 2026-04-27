// // components/CentralMonitorMenu.js
// import React, { useState } from 'react';
// import { Box, ListItem, ListItemButton, ListItemText, Collapse, List } from '@mui/material';
// import { Link, useLocation } from 'react-router-dom';
// import ExpandMore from '@mui/icons-material/ExpandMore';
// import ExpandLess from '@mui/icons-material/ExpandLess';



// export default function   CentralMonitorMenu() {
//   const [openGroup, setOpenGroup] = useState(true);
//   const location = useLocation();
//   return (
//     <List
//       sx={{
//         color: 'white',
//         background: '#272829'
//       }}
//     >
//       <ListItem disablePadding>
//         <ListItemButton 
//         onClick={() => setOpenGroup(!openGroup)}>
//           <ListItemText primary="Central Monitor" />
//           {openGroup ? <ExpandLess /> : <ExpandMore />}
//         </ListItemButton>
//       </ListItem>
//       <Collapse in={openGroup} timeout="auto" unmountOnExit>
//         <Box sx={{ pl: 4 }}>
//           <ListItem disablePadding>
//             <ListItemButton

//               component={Link}
//               to="/fleetview"
//               selected={location.pathname === "/fleetview"}
//               sx={{
//                   '&.Mui-selected':{
//                     backgroundColor: '#707070',
//                     color: 'white'  
//                   },
//                   '&.Mui-selected:hover':{
//                     backgroundColor: '#c4cbcc ',
//                   },
//                   '&:hover':{
//                     backgroundColor:'#b8d9d2'
//                   }
//               }}
//             >
//               <ListItemText primary="Fleet View" />
//             </ListItemButton>
//           </ListItem>
//           <ListItem disablePadding>
//             <ListItemButton
//               component={Link}
//               to="/sitelist"
//               selected={location.pathname === "/sitelist"}
//               sx={{
//                 '&.Mui-selected':{
//                   backgroundColor: '#707070',
//                   color: 'white'
//                 },
//                 '&.Mui-selected:hover':{
//                   backgroundColor: '#c4cbcc ',
//                 },
//                 '&:hover':{
//                   backgroundColor:'#b8d9d2'
//                 }
//             }}
//             >
//               <ListItemText primary="SiteList" />
//             </ListItemButton> 
//           </ListItem>
//           <ListItem disablePadding>
//             <ListItemButton
//               component={Link}
//               to="/leaderboard"
//               selected={location.pathname === "/leaderboard"}
//               sx={{
//                 '&.Mui-selected':{
//                   backgroundColor: '#acadac',
//                   color: 'white'
//                 },
//                 '&.Mui-selected:hover':{
//                   backgroundColor: '#707070',
//                 },
//                 '&:hover':{
//                   backgroundColor:'#b8d9d2'
//                 }
//             }}
//             >
//               <ListItemText primary="Leader Board" />
//             </ListItemButton>
//           </ListItem>
//         </Box>
//       </Collapse>
//     </List>
//   );
// }
