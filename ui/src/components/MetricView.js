import { Card, Col, Row, Switch} from "antd";
import React, { useMemo, useState, useEffect, useRef } from 'react';
import MemoMetricSelect from "./MetricSelect.js";
import LineChart from './LineChart.js';

const MetricView = ({ data, timeRange, selectedDims, selectedPoints, setSelectedDims, zScores, setzScores, setBaselines, fcs, baselines, nodeClusterMap, headers, selectedFile }) => {
    const baselinesRef = useRef({});
    const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);

    const headerMap = useMemo(() => {
      const map = {};
      headers.forEach(h => {
        if (h.filename && h.filename.endsWith('.json')) {
          const name = h.filename.replace('.json', '');
          map[name] = h;
        }
      });
      return map;
    }, [headers]);
    
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
        const handleUpdateEvent = (event) => {
          setSelectedTimeRange(event.detail);
        };
        window.addEventListener("batch-update-charts", handleUpdateEvent);
        return () => {
          window.removeEventListener("batch-update-charts", handleUpdateEvent);
        };
      }, []);

    if (!data || !baselines) return;

    function toCustomString(date) {
      return date.toString().replace(/ GMT[^\)]+(\))/g, ' GMT');
    }

    function updateZScores(oldZscores, newZscores) {
      const updatesMap = new Map(
        newZscores.map(d => {
            const { nodeId, ...rest } = d;
            return [nodeId, rest];
          })
      );

      return oldZscores.map(d => {
          if (updatesMap.has(d.nodeId)) {
              return {
                  ...d,
                  ...updatesMap.get(d.nodeId)
              };
          }
          return d;
      });
    }

    const updateBaseline = (field, newBaseline) => {
      console.log(field, newBaseline)
      baselinesRef.current[field] = newBaseline;
      const [start, end] = newBaseline.baselineX;
      const [v_min, v_max] = newBaseline.baselineY;

      const b_start = toCustomString(start);
      const b_end = toCustomString(end);
      
      // updating baselines
      setBaselines(prevBaselines => {
        const exists = prevBaselines.some(b => b.feature === field);
      
        if (exists) {
          return prevBaselines.map(b =>
            b.feature === field
              ? { ...b, b_start, b_end, v_min, v_max }
              : b
          );
        } else {
          return [
            ...prevBaselines,
            { feature: field, b_start, b_end, v_min, v_max }
          ];
        }
      });
      fetch(`http://127.0.0.1:5010/mrdmd/${selectedPoints}/${field}/0/1/${v_min}/${v_max}/${b_start}/${b_end}`)
        .then(response => response.json())
        .then(data => {
            // updating baselines and z-scores
            const updatedZScores = updateZScores(zScores, data.zscores);
            setzScores(updatedZScores)
        })
        .catch(error => console.error('Error fetching data:', error));
    };

    function mergeZScores(oldZScores, newZScores, newFeature) {
      let zscoreMap = Object.fromEntries(
          oldZScores.map(entry => [entry.nodeId, { ...entry }])
      );

      newZScores.forEach(entry => {
          const { nodeId, ...newValues } = entry;
          if (zscoreMap[nodeId]) {
              zscoreMap[nodeId] = { 
                  nodeId, 
                  [newFeature]: newValues[newFeature],  
                  ...zscoreMap[nodeId] 
              };
          } else {
              zscoreMap[nodeId] = { nodeId, [newFeature]: newValues[newFeature] };
          }
      });

      return Object.values(zscoreMap);
    }

    const handleMetricSelectChange = (key) => {
      if (selectedDims.includes(key)) {
        setSelectedDims(prev => prev.filter(dim => dim !== key));
        setzScores(prevZ => prevZ.map(z => {
          const { [key]: _, ...rest } = z;
          return rest;
        }));
        return;
      }

      if (!featureData[key]) {
        fetch(`http://127.0.0.1:5010/nodeData/${key}/${selectedFile}`)
          .then(res => res.json())
          .then(newData => {
            const processedColumn = newData.data.map(row => ({
              value: row[key],
              timestamp: new Date(row.timestamp),
              nodeId: row.nodeId
            }));
            setFeatureData(prev => ({ ...prev, [key]: processedColumn }));
          });
      }

      fetch(`http://127.0.0.1:5010/mrdmd/${selectedPoints}/${key}/1/0/0/0/0/0`)
        .then(res => res.json())
        .then(dmdData => {
          setzScores(prev => mergeZScores(prev, dmdData.zscores, key));
          setBaselines(prev => [...dmdData.baselines, ...prev]);
          dmdData.baselines.forEach(baseline => {
            baselinesRef.current[baseline.feature] = {
              baselineX: [
                new Date(baseline.b_start.replace("GMT", "")),
                new Date(baseline.b_end.replace("GMT", ""))
              ],
              baselineY: [baseline.v_min, baseline.v_max]
            };
          });
          setSelectedDims(prev => prev.includes(key) ? prev.filter(dim => dim !== key) : [key, ...prev]);
        });
    };

    return (
      <Card title="METRIC READING VIEW" size="small" style={{ height: "auto" }}> 
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
              <div style={{ overflow: 'auto', maxHeight: '480px' }}>
                {nodeClusterMap.size > 0 && selectedDims.map((field, index) => {
                    return (
                        <LineChart 
                            key={`chart-${index}`}
                            data={filteredData.get(field)}
                            field={field} 
                            index={index}
                            baselinesRef={baselinesRef}
                            updateBaseline={updateBaseline}
                            nodeClusterMap={nodeClusterMap}
                            metadata={headerMap[field]}
                        />
                    );
                })}
              </div>
            </Col>
            {/* Right column: List */}
            <Col span={8}>
                {/* TODO: move this to sidebar at the app level */}
                <MemoMetricSelect 
                    data={data} 
                    selectedDims={selectedDims}
                    featureData={featureData} 
                    nodeClusterMap={nodeClusterMap} 
                    fcs={fcs} 
                    onMetricSelectChange={handleMetricSelectChange} />
            </Col>
        </Row>
      </Card>
    );
};

export default MetricView;