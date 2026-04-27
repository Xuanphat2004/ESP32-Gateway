



// function RowBar(label, value, maxvalue, maxwidth, maxheight) {
//     const ratio_width = ((value*maxwidth)/maxvalue)*100;
//     return (
//         <div>
//             <div>{label}</div>
//             <div>
//                 <span style={{
//                     height: `${maxheight}px`,
//                     width: `${ratio_width}%`, 
//                     backgroundColor: "yellow",
//                 }}/>
//                 <span>{value}</span>
//             </div>
//         </div>
//     )
// }



function RowBar({ label, value, maxvalue, maxwidth = 300, maxheight = 8, unit }) {
    const ratio_width = (value / maxvalue) * maxwidth;

    return (
        <div>
            <div style={{ color: "grey", fontSize: "14px", marginBottom: "4px" }}>
                {label}
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
                {/* Bar wrapper with fixed width */}
                <div
                    style={{
                        width: `${maxwidth}px`,
                        height: `${maxheight}px`,
                        backgroundColor: "#444", // màu nền thanh (giống progress background)
                        position: "relative",
                        borderRadius: "4px",
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            width: `${ratio_width}px`,
                            height: "100%",
                            backgroundColor: "#26c281", // xanh lá đậm
                            transition: "width 0.3s",
                        }}
                    />
                </div>

                {/* Value text */}
                <div
                    style={{
                        marginLeft: "10px",
                        color: "#26c281",
                        fontSize: "14px",
                        whiteSpace: "nowrap"
                    }}
                >
                    {value} {unit}
                </div>
            </div>
        </div>
    );
}
export default RowBar