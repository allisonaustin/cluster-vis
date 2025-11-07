import * as d3 from 'd3';
import { Card, Col, Row } from "antd";
import React, { useMemo, useState, useEffect, useRef } from 'react';
import MemoMetricSelect from "./MetricSelect.js";
import LineChart from './LineChart.js';
import { colorScale } from '../utils/colors.js';

const MetricView = ({ data, timeRange, selectedDims, selectedPoints, setSelectedDims, zScores, setzScores, setBaselines, fcs, baselines, nodeClusterMap, headers }) => {
    const baselinesRef = useRef({});
    const chartsRef = useRef([]);
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

    useEffect(() => {
      const handleTimeDomainUpdate = (event) => {
        const newDomain = event.detail;
        const [start, end] = newDomain;

        chartsRef.current.forEach(({ chartEl, xScale, yScale, lines }) => {
            xScale.domain(newDomain);
            chartEl.select('.x-axis')
              .call(d3.axisBottom(xScale)
              .ticks(6)
              .tickFormat(d3.timeFormat("%H:%M")))
              .selectAll("text")       
              .style("font-size", "20px");

            lines.each(function(d) {
              const filteredPoints = d[1].filter(p => p.timestamp >= start && p.timestamp <= end);

              const lineGenerator = d3.line()
                  .x(p => xScale(p.timestamp))
                  .y(p => yScale(p.value));

              d3.select(this).attr('d', lineGenerator(filteredPoints));
            });
          });
      };

      window.addEventListener('time-domain-updated', handleTimeDomainUpdate);
      return () => window.removeEventListener('time-domain-updated', handleTimeDomainUpdate);
    }, []);

    // Updating line chart colors on cluster config
    useEffect(() => {
      if (!nodeClusterMap || chartsRef.current.length === 0) return;

      chartsRef.current.forEach(({ chartEl }) => {
        chartEl.selectAll('.line')
          .transition()
          .duration(300)
          .attr('stroke', function() {
            const nodeId = d3.select(this).attr('nodeId');
            const clusterId = nodeClusterMap.get(nodeId);
            return colorScale(clusterId); 
          });
      });
    }, [nodeClusterMap]);

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
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <MemoMetricSelect 
                selectedDims={selectedDims}
                metricData={data} 
                nodeClusterMap={nodeClusterMap} 
                features={Object.keys(headerMap)}
                fcs={fcs} 
                onMetricSelectChange={handleMetricSelectChange} />
        </Col>
          <Col span={16}>
            <div style={{ overflow: 'auto', maxHeight: '470px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'flex-end', 
                marginBottom: '8px', 
                marginLeft: '8px' 
              }}>
              <div style={{
                width: '16px',
                height: '16px',
                backgroundColor: 'grey',
                marginRight: '8px',
                border: '1px solid #999'
              }} />
              <span style={{ fontSize: '14px' }}>Baseline Region</span>
              </div>
              {nodeClusterMap.size > 0 && selectedDims.map((field, index) => {
                  return (
                      <LineChart 
                          key={`chart-${field}`}
                          data={data[field]}
                          field={field} 
                          baselinesRef={baselinesRef}
                          selectedTimeRange={selectedTimeRange}
                          updateBaseline={updateBaseline}
                          nodeClusterMap={nodeClusterMap}
                          metadata={headerMap[field]}
                          registerChart={(chartObj) => {
                              chartsRef.current.push(chartObj);
                          }}
                      />
                  );
              })}
            </div>
          </Col>
        </Row>
      </Card>
    );
};

export default MetricView;