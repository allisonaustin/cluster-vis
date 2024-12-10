import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { COLORS, getColor, generateColor } from '../utils/colors.js';
import * as d3 from 'd3';

const Matrix = ({ data }) => {
    const svgContainerRef = useRef();
    const [matData, setMatData] = useState([]);
    const [size, setSize] = useState({ width: 600, height: 300 });

    useEffect(() => {
        if (!svgContainerRef.current) return;
        setMatData(data);
        
        
    });

    return <div ref={svgContainerRef} style={{ width: '100%', height: '280px' }}></div>;
};

export default Matrix;