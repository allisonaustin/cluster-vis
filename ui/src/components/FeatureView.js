import React, { useState, useEffect, useRef } from 'react';
import { getColor } from '../utils/colors.js';
import { Card, List, Checkbox, Row, Col } from "antd";
import * as d3 from 'd3';
import LineChart from './LineChart.js';

const FeatureView = ({ data, selectedDims, selectedPoints, setSelectedDims, hoveredPoint, setHoveredPoint }) => {
    const dims = selectedDims.filter(field => data.data && data.data.length > 0 && field in data.data[0]);
    const features = data.features;

  const handleCheckboxChange = (key) => {
    setSelectedDims(prevSelectedDims => {
        if (prevSelectedDims.includes(key)) {
            return prevSelectedDims.filter(dim => dim !== key);
        } else {
            return [...prevSelectedDims, key];
        }
    });
}

  return (
      <Card title="FEATURE VIEW" size="small" style={{ height: "auto", maxHeight: '530px', overflow:'auto' }}> 
        <Row gutter={[16, 16]}>
            {/* Left column: List */}
            <Col span={6}>
                <List
                    style={{ width: "100%", maxWidth: 200, overflowY: "auto", marginRight: "10px" }}
                    bordered
                    dataSource={features}
                    renderItem={(key, index) => {
                    return (
                        <List.Item key={key} style={{ display: "flex", alignItems: "center", padding: "5px 10px" }}>
                        <Checkbox
                            checked={selectedDims.includes(key)}
                            onChange={() => handleCheckboxChange(key)}
                            style={{ marginRight: "10px" }}
                        />
                        <span style={{ flexGrow: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {key}
                        </span>
                        </List.Item>
                    );
                    }}
                />
            </Col>
            <Col span={18}>
                {dims.map((field, index) => (
                    <LineChart 
                        key={`chart-${index}`}
                        data={data.data} 
                        field={field} 
                        index={index} 
                        selectedPoints={selectedPoints}
                        hoveredPoint={hoveredPoint}
                        setHoveredPoint={setHoveredPoint}
                    />
                ))}
            </Col>
        </Row>
      </Card>
    );
};
    
export default FeatureView;