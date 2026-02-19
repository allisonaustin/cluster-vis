import * as d3 from 'd3';
import { useState, useEffect, useRef } from 'react';
import { Switch, Space } from 'antd';
import LineChart from './LineChart.js';
import { colorScale, COLORS } from '../utils/colors.js';

const MetricView = ({ data, timeRange, selectedDims, selectedPoints, zScores, setzScores, setBaselines, baselines, baselinesRef, nodeClusterMap, headerMap }) => {
    const chartsRef = useRef([]);
    const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
    const [showBaselines, setShowBaselines] = useState(true);
    
    useEffect(() => {
      const handleTimeDomainUpdate = (event) => {
        const newDomain = event.detail;
        const [start, end] = newDomain;

        chartsRef.current.forEach(({ chartEl, xScale, yScale, lines, field, brushGroup }) => {
          if (!chartEl || !lines) return;

          xScale.domain(newDomain);
          
          chartEl.select('.x-axis')
            .call(d3.axisBottom(xScale)
            .ticks(6)
            .tickFormat(d3.timeFormat("%H:%M")))
            .selectAll("text").style("font-size", "16px");

          const lineGenerator = d3.line()
            .x(p => xScale(new Date(p.timestamp)))
            .y(p => yScale(p.value));

          lines.attr('d', d => {
            if (!d || !d[1]) return null;
            
            const filteredPoints = d[1].filter(p => {
                const ts = new Date(p.timestamp);
                return ts >= start && ts <= end;
            });
            return lineGenerator(filteredPoints);
          });

          const baseline = baselinesRef.current[field];
          if (baseline && brushGroup) {
              const x0 = xScale(new Date(baseline.baselineX[0]));
              const x1 = xScale(new Date(baseline.baselineX[1]));
              const yTop = yScale(baseline.baselineY[1]);
              const yBottom = yScale(baseline.baselineY[0]);

              // Only move if it's visible in the new range
              const [rMin, rMax] = xScale.range();
              if (x1 >= rMin && x0 <= rMax) {
                  brushGroup.call(d3.brush().move, [[x0, yTop], [x1, yBottom]]);
              } else {
                  brushGroup.call(d3.brush().move, null);
              }
          }
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

    const updateBaseline = (field, newBaseline) => {
      // console.log(field, newBaseline)
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
            if (data.zscores) {
              setzScores(prevZScores => {
                const updatesMap = new Map(
                    data.zscores.map(d => {
                        return [d.nodeId, d[field]]; 
                    })
                );

                return prevZScores.map(d => {
                    if (updatesMap.has(d.nodeId)) {
                        const newValue = updatesMap.get(d.nodeId);
                        const isValid = newValue !== null && newValue !== undefined && newValue !== "";

                        return {
                            ...d,
                            [field]: isValid ? parseFloat(newValue) : d[field]
                        };
                    }
                    return d;
                });
              });
            }
        })
        .catch(error => console.error('Error fetching data:', error));
    };

    return (
      <div style={{ overflow: 'auto', maxHeight: '450px' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'flex-end', 
          marginBottom: '8px', 
          marginRight: '10px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backgroundColor: 'white',
        }}>
          {/* Legend */}
          <div style={{
            width: '12px',
            height: '12px',
            backgroundColor: COLORS.default,
            marginRight: '8px',
            border: '1px solid '+COLORS.default,
            borderRadius: '2px'
          }} />
          <span style={{ fontSize: '14px', paddingRight: '10px' }}>Baseline Region</span>
          <Space>
            <Switch 
                size="small" 
                checked={showBaselines} 
                onChange={(checked) => setShowBaselines(checked)} 
            />
          </Space>
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
                    showBaselines={showBaselines}
                />
            );
        })}
      </div>
    );
};

export default MetricView;