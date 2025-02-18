import React from 'react'

const Tooltip = ({ visible, content, x, y }) => {
    if (!visible) return null;

    const tooltipStyle = {
        position: 'absolute',
        left: x + 10, 
        top: y + 10,
        backgroundColor: 'white',
        padding: '8px',
        border: '0.5px solid black',
        borderRadius: '4px',
        pointerEvents: 'none',
        zIndex: 1000,
      };

    return <div className="tooltip" style={tooltipStyle}>{content}</div>
};

export default Tooltip;