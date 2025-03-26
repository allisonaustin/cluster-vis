import React, { useState, useEffect, useRef } from 'react';
import { getColor, colorScale, colorScheme } from '../utils/colors.js';
import { Card, List, Checkbox } from "antd";
import * as d3 from 'd3';
import Tooltip from '../utils/tooltip.js';

const MRDMD = ({ data }) => {
    const svgContainerRef = useRef();
    const firstRenderRef = useRef(true);
    const [plotData, setPlotData] = useState([]);
    const [size, setSize] = useState({ width: 700, height: 380 });
    const [margin, setMargin] = useState({ top: 50, right: 40, bottom: 20, left: 20 });
    const [tooltip, setTooltip] = useState({
        visible: false,
        content: '',
        x: 0,
        y: 0
    });


    useEffect(() => {
        if (!svgContainerRef.current) return;
        d3.select(svgContainerRef.current).selectAll("*").remove();
        setPlotData(data);
        
        firstRenderRef.current = false;

        
    }, [data]);
      

return (
    <Card title="MRDMD VIEW" size="small" style={{ height: "auto" }}>
        <div style={{ position: "relative", width: "100%", height: "330px" }}>
          <div ref={svgContainerRef} style={{ width: "100%", height: "100%" }}></div>
        </div>
    </Card>
    );
};

export default MRDMD;