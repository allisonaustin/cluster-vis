import { Card, Col, Row } from "antd";
import React, { useMemo, useState } from 'react';
import FeatureSelect from "./FeatureSelect.js";
import LineChart from './LineChart.js';

const FeatureView = ({ data, selectedDims, selectedPoints, setSelectedDims, fcs }) => {
    let processed = {};
    const [featureData, setFeatureData] = useState(processed);
    
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
    const [selectedTimeRange, setSelectedTimeRange] = useState(['2024-02-21 16:07:30Z', '2024-02-21 17:41:45Z'])
    const filteredData = useMemo(() => {
        const selectedNodes = new Set(selectedPoints);
        const start = new Date(selectedTimeRange[0]);
        const end = new Date(selectedTimeRange[1]);
        const newFilteredData = new Map(Object.entries(featureData)
            .map(([feature, data]) => ([feature, data.filter(d => selectedNodes.has(d.nodeId) && new Date(d.timestamp) >= start && new Date(d.timestamp) <= end)])));
        console.log(newFilteredData);
        return newFilteredData;
    }, [selectedTimeRange, selectedPoints, featureData])

    const handleUpdateEvent = (event) => {
        setSelectedTimeRange(event.detail);
    };

    window.addEventListener(`batch-update-charts`, handleUpdateEvent);

    return (
      <Card title="FEATURE VIEW" size="small" style={{ height: "auto", maxHeight: '530px', overflow:'auto' }}> 
        <Row gutter={[16, 16]}>
            {/* Left column: List */}
            <Col span={10}>
                {/* TODO: move this to sidebar at the app level */}
                <FeatureSelect 
                    data={data} processed={processed} selectedDims={selectedDims}
                    selectedPoints={selectedPoints} setSelectedDims={setSelectedDims}
                    featureData={featureData} setFeatureData={setFeatureData} fcs={fcs}/>
            </Col>
            <Col span={14}>
                {selectedDims.map((field, index) => {
                    return (
                        <LineChart 
                            key={`chart-${index}`}
                            data={filteredData.get(field)}
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