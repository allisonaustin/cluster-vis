import { Card, Col, Row, Switch} from "antd";
import React, { useMemo, useState, useEffect, useRef } from 'react';
import FeatureSelect from "./FeatureSelect.js";
import LineChart from './LineChart.js';

const FeatureView = ({ data, timeRange, selectedDims, selectedPoints, setSelectedDims, fcs, baselines, DRData }) => {
    let processed = {};
    const baselinesRef = useRef({});
    const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
    
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
    const [nodeClusterMap, setNodeClusterMap] = useState(new Map());
    const filteredData = useMemo(() => {
        const selectedNodes = new Set(selectedPoints);
        const start = new Date(selectedTimeRange[0]);
        const end = new Date(selectedTimeRange[1]);
        const newFilteredData = new Map(Object.entries(featureData)
            .map(([feature, data]) => ([feature, data.filter(d => selectedNodes.has(d.nodeId) && new Date(d.timestamp) >= start && new Date(d.timestamp) <= end)])));
        return newFilteredData;
    }, [selectedTimeRange, selectedPoints, featureData])

    useEffect(() => {
        if (!baselines) return;
        const initialBaselines = baselines.reduce((acc, baseline) => {
            acc[baseline.feature] = {
                baselineX: [new Date(baseline.b_start.replace("GMT", "")), new Date(baseline.b_end.replace("GMT", ""))],
                baselineY: [baseline.v_min, baseline.v_max]
            };
            return acc;
        })
        baselinesRef.current = initialBaselines;
    }, []);

    useEffect(() => {
        if (!DRData) return; 
        const clusters = new Map();
        DRData.forEach(d => {
            clusters.set(d.nodeId, d.Cluster);
        });
        setNodeClusterMap(clusters);  
    }, [DRData]);

    if (!data || !baselines) return;

    const updateBaseline = (field, newBaseline) => {
        baselinesRef.current[field] = newBaseline;
      };

    const handleUpdateEvent = (event) => {
        setSelectedTimeRange(event.detail);
    };

    window.addEventListener(`batch-update-charts`, handleUpdateEvent);

    return (
      <Card title="FEATURE VIEW" size="small" style={{ height: "auto", maxHeight: '530px', overflow:'auto' }}> 
        <Row gutter={[16, 16]}>
            <Col span={16}>
                {nodeClusterMap.size > 0 && selectedDims.map((field, index) => {
                    return (
                        <LineChart 
                            key={`chart-${index}`}
                            data={filteredData.get(field)}
                            field={field} 
                            index={index}
                            baselineX={baselinesRef.current[field]?.baselineX || []}
                            baselineY={baselinesRef.current[field]?.baselineY || []}
                            updateBaseline={updateBaseline}
                            nodeClusterMap={nodeClusterMap}
                        />
                    );
                })}
            </Col>
            {/* Right column: List */}
            <Col span={8}>
                {/* TODO: move this to sidebar at the app level */}
                <FeatureSelect 
                    data={data} processed={processed} selectedDims={selectedDims}
                    selectedPoints={selectedPoints} setSelectedDims={setSelectedDims}
                    featureData={featureData} setFeatureData={setFeatureData} fcs={fcs}/>
            </Col>
        </Row>
      </Card>
    );
};

export default FeatureView;