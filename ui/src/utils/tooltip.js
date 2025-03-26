import React from 'react';

const Tooltip = ({ visible, content, x, y }) => {
    if (!visible) return null;

    const tooltipStyle = {
        position: 'fixed',
        left: x, 
        top: y,
        backgroundColor: 'white',
        padding: '8px',
        border: '0.5px solid black',
        borderRadius: '4px',
        pointerEvents: 'none',
        zIndex: 1000,
        transform: 'translateX(-50%) translateY(+50%)'
      };

    return <div className="tooltip" style={tooltipStyle}>{content}</div>
};

export default Tooltip;