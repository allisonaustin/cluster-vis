import { Card, Col, Row, Switch} from "antd";
import React, { useMemo, useState, useEffect, useRef } from 'react';
import FeatureSelect from "./FeatureSelect.js";
import LineChart from './LineChart.js';

const FeatureView = ({ data, timeRange, selectedDims, selectedPoints, setSelectedDims, zScores, setzScores, setBaselines, fcs, baselines, nodeClusterMap }) => {
    const baselinesRef = useRef({});
    const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
    
    const processed = useMemo(() => {
        const proc = {};
        data.data.forEach(row => {
          Object.keys(row).forEach(key => {
            if (key !== "timestamp" && key !== "nodeId") { 
              if (!proc[key]) {
                proc[key] = [];
              }
              proc[key].push({
                value: row[key],
                timestamp: new Date(row.timestamp),
                nodeId: row.nodeId
              });
            }
          });
        });
        return proc;
      }, [data]); 

    const [featureData, setFeatureData] = useState(processed);
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
                baselineX: [
                    new Date(baseline.b_start.replace("GMT", "")), 
                    new Date(baseline.b_end.replace("GMT", ""))
                ],
                baselineY: [baseline.v_min, baseline.v_max]
            };
            return acc;  
        }, {});
    
        baselinesRef.current = initialBaselines;
    }, []);

    useEffect(() => {
        const handleUpdateEvent = (event) => {
          setSelectedTimeRange(event.detail);
        };
        window.addEventListener("batch-update-charts", handleUpdateEvent);
        return () => {
          window.removeEventListener("batch-update-charts", handleUpdateEvent);
        };
      }, []);

    if (!data || !baselines) return;

    const updateBaseline = (field, newBaseline) => {
        baselinesRef.current[field] = newBaseline;
      };

    return (
      <Card title="FEATURE VIEW" size="small" style={{ height: "auto", maxHeight: '450px', overflow:'auto' }}> 
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', marginLeft: '8px' }}>
        <div style={{
          width: '16px',
          height: '16px',
          backgroundColor: 'grey',
          marginRight: '8px',
          border: '1px solid #999'
        }} />
        <span style={{ fontSize: '14px' }}>Baseline Region</span>
      </div>
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
                    featureData={featureData} setFeatureData={setFeatureData} fcs={fcs} zScores={zScores} 
                    setzScores={setzScores} baselines={baselines} setBaselines={setBaselines} baselinesRef={baselinesRef} />
            </Col>
        </Row>
      </Card>
    );
};

export default FeatureView;