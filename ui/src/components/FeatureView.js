import { Card, Checkbox, Col, List, Row } from "antd";
import React, { useState } from 'react';
import LineChart from './LineChart.js';

const FeatureView = ({ data, selectedDims, selectedPoints, setSelectedDims }) => {
    let processed = {};

    data.data.forEach(row => {
        Object.keys(row).forEach(key => {
            if (key !== "timestamp" && key !== "nodeId") { 
                if (!processed[key]) {
                    processed[key] = []; 
                }
                processed[key].push({
                    value: row[key],
                    timestamp: new Date(row.timestamp),
                    nodeId: row.nodeId
                });
            }
        });
    });
    const [featureData, setFeatureData] = useState(processed);
    const [selectedTimeRange, setSelectedTimeRange] = useState(['2024-02-21 16:07:30Z', '2024-02-21 17:41:45Z'])

  const handleCheckboxChange = (key) => {
    const existingColumns = Object.keys(featureData);
    if (!existingColumns.includes(key)) {
        fetch(`http://127.0.0.1:5010/nodeData/${key}`)
            .then(response => response.json())
            .then(newData => {
                if (newData.data.length === featureData[Object.keys(featureData)[0]].length) {
                    const processedColumn = newData.data.map(row => ({
                        value: row[key],  
                        timestamp: new Date(row.timestamp), 
                        nodeId: row.nodeId
                    }));    
                    setFeatureData(featureData => ({
                        ...featureData,
                        [key]: processedColumn  // new column
                    }));
                } else {
                    console.error(`Data length mismatch: expected ${processed[Object.keys(processed)[0]].length}, got ${newData.data.length}`);
                }
            })
            .catch(error => console.error('Error fetching data:', error));
    }
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
            <Col span={8}>
                <List
                    style={{ width: "100%", maxWidth: 300, overflowY: "auto", marginRight: "10px" }}
                    bordered
                    dataSource={data.features}
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
            <Col span={16}>
                {selectedDims.map((field, index) => {
                    const selectedNodes = new Set(selectedPoints);
                    const start = new Date(selectedTimeRange[0]);
                    const end = new Date(selectedTimeRange[1]);
                    const filteredData = featureData[field]?.filter(d => 
                        selectedNodes.has(d.nodeId) && 
                        new Date(d.timestamp) >= start && 
                        new Date(d.timestamp) <= end
                    ) || [];
                    
                    return (
                        <LineChart 
                            key={`chart-${index}`}
                            data={filteredData} 
                            field={field} 
                            index={index} 
                        />
                    )
                })}
            </Col>
        </Row>
      </Card>
    );
};
    
export default FeatureView;