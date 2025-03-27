import { Card, Checkbox, Col, List, Row } from "antd";
import React, { useState } from 'react';
import LineChart from './LineChart.js';

const FeatureView = ({ data, selectedDims, selectedPoints, setSelectedDims, hoveredPoint, setHoveredPoint }) => {
    const dims = selectedDims.filter(field => data.data && data.data.length > 0 && field in data.data[0]);
    const features = data.features;
    const [selectedTimeRange, setSelectedTimeRange] = useState(['2024-02-21 16:07:30Z', '2024-02-21 17:41:45Z'])

  const handleCheckboxChange = (key) => {
    setSelectedDims(prevSelectedDims => {
        if (prevSelectedDims.includes(key)) {
            return prevSelectedDims.filter(dim => dim !== key);
        } else {
            return [...prevSelectedDims, key];
        }
    });
  }

    const handleUpdateEvent = (event) => {
        setSelectedTimeRange(event.detail);
    };

    window.addEventListener(`batch-update-charts`, handleUpdateEvent);

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
                {dims.map((field, index) => {
                    const selectedNodes = new Set(selectedPoints);
                    const start = new Date(selectedTimeRange[0]);
                    const end = new Date(selectedTimeRange[1]);
                    console.log('Selecting time range', start, end);
                    const filteredData = data.data.map(d => ({
                        timestamp: new Date(d.timestamp),
                        nodeId: d.nodeId,
                        value: d[field]
                    })).filter(d => selectedNodes.has(d.nodeId) && d.timestamp >= start && d.timestamp <= end);
                    
                    return (
                        <LineChart 
                            key={`chart-${index}`}
                            data={filteredData} 
                            field={field} 
                            index={index} 
                            selectedPoints={selectedPoints}
                            hoveredPoint={hoveredPoint}
                            setHoveredPoint={setHoveredPoint}
                        />
                    )
                })}
            </Col>
        </Row>
      </Card>
    );
};
    
export default FeatureView;