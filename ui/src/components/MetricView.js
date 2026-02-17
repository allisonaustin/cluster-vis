import * as d3 from 'd3';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import LineChart from './LineChart.js';
import { colorScale, COLORS } from '../utils/colors.js';

const MetricView = ({ data, timeRange, selectedDims, selectedPoints, zScores, setzScores, setBaselines, baselines, baselinesRef, nodeClusterMap, headerMap }) => {
    const chartsRef = useRef([]);
    const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
    useEffect(() => {
      const handleTimeDomainUpdate = (event) => {
        const newDomain = event.detail;
        const [start, end] = newDomain;

        chartsRef.current.forEach(({ chartEl, xScale, yScale, lines, field, brushGroup }) => {
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

            const baseline = baselinesRef.current[field];
              if (baseline && brushGroup) {
                  const x0 = d3.max([baseline.baselineX[0], xScale.domain()[0]]);
                  const x1 = d3.min([baseline.baselineX[1], xScale.domain()[1]]);
                  const y0 = d3.max([baseline.baselineY[0], yScale.domain()[0]]);
                  const y1 = d3.min([baseline.baselineY[1], yScale.domain()[1]]);

                  brushGroup.call(d3.brush().move, [[xScale(x0), yScale(y1)], [xScale(x1), yScale(y0)]]);
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
            // updating baselines and z-scores
            const updatedZScores = updateZScores(zScores, data.zscores);
            setzScores(updatedZScores)
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
          marginRight: '10px'
        }}>
          <div style={{
            width: '12px',
            height: '12px',
            backgroundColor: COLORS.default,
            marginRight: '8px',
            border: '1px solid '+COLORS.default,
            borderRadius: '2px'
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
    );
};

export default MetricView;