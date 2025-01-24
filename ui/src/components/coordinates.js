import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const Coordinates = ({ data }) => {
    const svgContainerRef = useRef();
    const [plotData, setPlotData] = useState([]);
    const [size, setSize] = useState({ width: 600, height: 300 });

    useEffect(() => {
        if (!svgContainerRef.current) return;
        setPlotData(data);
        
    }, [data]);

    return <div ref={svgContainerRef} style={{ width: '100%', height: '280px' }}></div>;
};

export default Coordinates;