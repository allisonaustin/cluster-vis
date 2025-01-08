import React, { useEffect, useState } from 'react';
import * as d3 from 'd3';
import { BrushSelection } from 'd3';
import { useRef } from 'react';

interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  field: string;
}

interface AnomalyPoint {
  timestamp: string;
  value: number;
  field: string;
  type: 'Zero Value' | 'Sharp Change';
}

export default function BidirectionalBarChart() {
  const [targetFields, setTargetFields] = useState<string[]>([]);
  const [zeroValueAnomalies, setZeroValueAnomalies] = useState<AnomalyPoint[]>([]);
  const [sharpChangeAnomalies, setSharpChangeAnomalies] = useState<AnomalyPoint[]>([]);
  const [brushStart, setBrushStart] = useState<Date | null>(null);
  const [brushEnd, setBrushEnd] = useState<Date | null>(null);
  const [highlightedBars, setHighlightedBars] = useState('');
  const [searchIdx, setSearchIdx] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const brushStateRef = useRef<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [selectedTimeText, setSelectedTimeText] = useState<string>('None');


  const size = { width: 800, height: 100 }; // Timeline size
  const chartSize = { width: 600, height: 600 }; // Individual bar chart size
  const margin = { top: 30, right: 20, bottom: 50, left: 40 };

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load target fields
        const targetData = await d3.csv('../../data/target_fields_new.csv').then((data) =>
          Array.from(new Set(data.flatMap((row) => Object.keys(row).filter((key) => key !== 'timestamp'))))
        );

        setTargetFields(targetData);

        // Load zero-value anomalies
        const zeroValueAnomalies = await d3.csv('../../data/zero_value_periods.csv').then((data) =>
          data.map((row) => ({
            timestamp: row.Timestamp!,
            field: row.Field!,
            value: +row.Value!,
            type: 'Zero Value' as const,
          }))
        );

        // Load sharp-change anomalies
        const sharpChangeAnomalies = await d3.csv('../../data/sharp_change_periods.csv').then((data) =>
          data.map((row) => ({
            timestamp: row.Timestamp!,
            field: row.Field!,
            value: +row.Value!,
            type: 'Sharp Change' as const,
          }))
        );

        setZeroValueAnomalies(zeroValueAnomalies);
        setSharpChangeAnomalies(sharpChangeAnomalies);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, []);

  // useEffect(() => {
  //   if (!targetFields.length || (!zeroValueAnomalies.length && !sharpChangeAnomalies.length)) return;
  //   initTimeline();
  //   updateBarCharts();
  // }, [targetFields, zeroValueAnomalies, sharpChangeAnomalies, brushStart, brushEnd]); // Add brushStart and brushEnd
  // useEffect(() => {
  //   if (!targetFields.length || (!zeroValueAnomalies.length && !sharpChangeAnomalies.length)) return;
  
  //   initTimeline();
  //   updateBarCharts(); // Initialize bar charts with the full dataset
  // }, [targetFields, zeroValueAnomalies, sharpChangeAnomalies]); // Run only when data changes

  useEffect(() => {
    if (!targetFields.length || (!zeroValueAnomalies.length && !sharpChangeAnomalies.length)) return;
  
    initTimeline();
    updateZeroBarChart(); // Initialize Zero Value Bar Chart
    updateSharpBarChart(); // Initialize Sharp Change Bar Chart
  }, [targetFields, zeroValueAnomalies, sharpChangeAnomalies]); // Run only when data changes
  

  // useEffect(() => {
  //   if (brushStart && brushEnd) {
  //     updateBarCharts(); // Update bar charts based on the selected time range
  //   }
  // }, [brushStart, brushEnd]); // Trigger only on brush selection changes
  useEffect(() => {
    if (brushStart && brushEnd) {
      updateZeroBarChart(); // Update Zero Value Bar Chart based on the selected time range
      updateSharpBarChart(); // Update Sharp Change Bar Chart based on the selected time range
    }
  }, [brushStart, brushEnd]); // Trigger only on brush selection changes
  
  
  const initTimeline = () => {
    const svg = d3
      .select('#timeline')
      .attr('width', size.width)
      .attr('height', size.height)
      .attr('viewBox', `0 0 ${size.width} ${size.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');
  
    svg.selectAll('*').remove();
  
    const combinedData = [...zeroValueAnomalies, ...sharpChangeAnomalies];
  
    const xScale = d3
      .scaleTime()
      .domain(
        d3.extent(combinedData, (d) => new Date(d.timestamp)) as [Date, Date]
      )
      .range([margin.left, size.width - margin.right]);
  
    const xAxis = d3.axisBottom(xScale).tickFormat(d3.timeFormat('%H:%M')).tickSizeOuter(0);
  
    svg
      .append('g')
      .attr('transform', `translate(0, ${size.height - margin.bottom})`)
      .call(xAxis);
  
    const brush = d3
      .brushX()
      .extent([
        [margin.left, 0],
        [size.width - margin.right, size.height - margin.bottom],
      ])
      .on('brush end', (event) => {
        const selection = event.selection;
        if (selection) {
          const [start, end] = selection.map(xScale.invert);
          setBrushStart(start);
          setBrushEnd(end);
  
          // Dynamically update the selected time text
          setSelectedTimeText(
            `${d3.timeFormat('%Y-%m-%d %H:%M:%S')(start)} - ${d3.timeFormat('%Y-%m-%d %H:%M:%S')(end)}`
          );
        }
      });
  
    svg.append('g').attr('class', 'brush').call(brush);
  };
  
  // const updateBarCharts = () => {
  //   const indexedFields = targetFields.map((field, idx) => ({ idx: idx + 1, field }));
  
  //   const renderBarChart = (
  //     id: string,
  //     data: { idx: number; field: string; value: number }[],
  //     color: string
  //   ) => {
  //     const dynamicHeight = margin.top + margin.bottom + data.length * 20; // Increase based on number of bars
  //     const svg = d3.select(id)
  //       .attr("width", chartSize.width)
  //       .attr("height", dynamicHeight); // Dynamically set SVG height
  
  //     svg.selectAll('*').remove();
  
  //     const yScale = d3
  //       .scaleBand()
  //       .domain(data.map((d) => d.idx.toString()))
  //       .range([margin.top, dynamicHeight - margin.bottom])
  //       .padding(0.15);
  
  //     const xScale = d3
  //       .scaleLinear()
  //       .domain([0, d3.max(data, (d) => d.value) || 0])
  //       .range([margin.left, chartSize.width - margin.right]);
  
  //     const xAxis = d3.axisBottom(xScale).ticks(5);
  //     const yAxis = d3.axisLeft(yScale);
  
  //     svg
  //       .append('g')
  //       .attr('transform', `translate(0, ${dynamicHeight - margin.bottom})`) // Adjust x-axis position
  //       .call(xAxis);
  
  //     svg
  //       .append('g')
  //       .attr('transform', `translate(${margin.left}, 0)`)
  //       .call(yAxis);
  
  //     const tooltip = d3.select('#tooltip'); // Use d3.select for the tooltip
  
  //     svg
  //       .selectAll('.bar')
  //       .data(data)
  //       .join('rect')
  //       .attr('class', 'bar')
  //       .attr('x', margin.left)
  //       .attr('y', (d) => yScale(d.idx.toString()) ?? 0)
  //       .attr('width', (d) => xScale(d.value) - margin.left)
  //       .attr('height', yScale.bandwidth())
  //       .attr('fill', color)
  //       .on('mouseover', (event, d) => {
  //         tooltip
  //           .style('left', `${event.pageX + 5}px`)
  //           .style('top', `${event.pageY + 5}px`)
  //           .style('display', 'block')
  //           .html(
  //             `<strong>Idx:</strong> ${d.idx}<br>` +
  //             `<strong>Field:</strong> ${d.field}<br>` +
  //             `<strong>Value:</strong> ${d.value}`
  //           );
  //       })
  //       .on('mouseout', () => {
  //         tooltip
  //           .style('display', 'none') // Ensure tooltip is hidden
  //           .style('left', `-9999px`); // Move it out of view as a fallback
  //       });
  //   };
  
  //   const zeroData = indexedFields.map((field) => ({
  //     ...field,
  //     value: zeroValueAnomalies.filter((a) => a.field === field.field && withinBrush(a.timestamp)).length,
  //   }));
  
  //   const sharpData = indexedFields.map((field) => ({
  //     ...field,
  //     value: sharpChangeAnomalies.filter((a) => a.field === field.field && withinBrush(a.timestamp)).length,
  //   }));
  
  //   renderBarChart('#zero-bar-chart', zeroData, 'blue');
  //   renderBarChart('#sharp-bar-chart', sharpData, 'red');
  // };
  
  // const updateBarCharts = (sortOrder: 'desc' | 'original' = 'original') => {
  //   const indexedFields = targetFields.map((field, idx) => ({ idx: idx + 1, field }));
  
  //   const renderBarChart = (
  //     id: string,
  //     data: { idx: number; field: string; value: number }[],
  //     color: string,
  //     sortOrder: 'desc' | 'original'
  //   ) => {
  //     let sortedData = [...data];
  //     if (sortOrder === 'desc') {
  //       sortedData.sort((a, b) => b.value - a.value);
  //     } else if (sortOrder === 'original') {
  //       sortedData = [...data]; // Use the original data order
  //     }
  
  //     const dynamicHeight = margin.top + margin.bottom + sortedData.length * 20; // Increase based on number of bars
  //     const svg = d3.select(id).attr('width', chartSize.width).attr('height', dynamicHeight); // Dynamically set SVG height
  
  //     svg.selectAll('*').remove();
  
  //     const yScale = d3
  //       .scaleBand()
  //       .domain(sortedData.map((d) => d.idx.toString()))
  //       .range([margin.top, dynamicHeight - margin.bottom])
  //       .padding(0.15);
  
  //     const xScale = d3
  //       .scaleLinear()
  //       .domain([0, d3.max(sortedData, (d) => d.value) || 0])
  //       .range([margin.left, chartSize.width - margin.right]);
  
  //     const xAxis = d3.axisBottom(xScale).ticks(5);
  //     const yAxis = d3.axisLeft(yScale);
  
  //     svg
  //       .append('g')
  //       .attr('transform', `translate(0, ${dynamicHeight - margin.bottom})`) // Adjust x-axis position
  //       .call(xAxis);
  
  //     svg
  //       .append('g')
  //       .attr('transform', `translate(${margin.left}, 0)`)
  //       .call(yAxis);
  
  //     const tooltip = d3.select('#tooltip'); // Use d3.select for the tooltip
  
  //     svg
  //       .selectAll('.bar')
  //       .data(sortedData)
  //       .join('rect')
  //       .attr('class', 'bar')
  //       .attr('x', margin.left)
  //       .attr('y', (d) => yScale(d.idx.toString()) ?? 0)
  //       .attr('width', (d) => xScale(d.value) - margin.left)
  //       .attr('height', yScale.bandwidth())
  //       .attr('fill', color)
  //       .on('mouseover', (event, d) => {
  //         tooltip
  //           .style('left', `${event.pageX + 5}px`)
  //           .style('top', `${event.pageY + 5}px`)
  //           .style('display', 'block')
  //           .html(
  //             `<strong>Idx:</strong> ${d.idx}<br>` +
  //             `<strong>Field:</strong> ${d.field}<br>` +
  //             `<strong>Value:</strong> ${d.value}`
  //           );
  //       })
  //       .on('mouseout', () => {
  //         tooltip.style('display', 'none').style('left', `-9999px`); // Ensure tooltip is hidden
  //       });
  //   };
  
  //   const zeroData = indexedFields.map((field) => ({
  //     ...field,
  //     value: zeroValueAnomalies.filter((a) => a.field === field.field && withinBrush(a.timestamp)).length,
  //   }));
  
  //   const sharpData = indexedFields.map((field) => ({
  //     ...field,
  //     value: sharpChangeAnomalies.filter((a) => a.field === field.field && withinBrush(a.timestamp)).length,
  //   }));
  
  //   renderBarChart('#zero-bar-chart', zeroData, 'blue', sortOrder);
  //   renderBarChart('#sharp-bar-chart', sharpData, 'red', sortOrder);
  // };
  
  // Event handlers for sorting
  
  const updateZeroBarChart = (sortOrder: 'desc' | 'original' = 'original') => {
    const indexedFields = targetFields.map((field, idx) => ({ idx: idx + 1, field }));
  
    const zeroData = indexedFields.map((field) => ({
      ...field,
      value: zeroValueAnomalies.filter((a) => a.field === field.field && withinBrush(a.timestamp)).length,
    }));
  
    const renderBarChart = (
      id: string,
      data: { idx: number; field: string; value: number }[],
      color: string
    ) => {
      let sortedData = [...data];
      if (sortOrder === 'desc') {
        sortedData.sort((a, b) => b.value - a.value);
      }
    
      const dynamicHeight = margin.top + margin.bottom + sortedData.length * 20;
      const svg = d3.select(id).attr('width', chartSize.width).attr('height', dynamicHeight);
    
      svg.selectAll('*').remove();
    
      const yScale = d3
        .scaleBand()
        .domain(sortedData.map((d) => d.idx.toString()))
        .range([margin.top, dynamicHeight - margin.bottom])
        .padding(0.15);
    
      const xScale = d3
        .scaleLinear()
        .domain([0, d3.max(sortedData, (d) => d.value) || 0])
        .range([margin.left, chartSize.width - margin.right]);
    
      const xAxis = d3.axisBottom(xScale).ticks(5);
      const yAxis = d3.axisLeft(yScale);
    
      svg
        .append('g')
        .attr('transform', `translate(0, ${dynamicHeight - margin.bottom})`)
        .call(xAxis);
    
      svg
        .append('g')
        .attr('transform', `translate(${margin.left}, 0)`)
        .call(yAxis);
    
      const tooltip = d3.select('#tooltip'); // Tooltip element
    
      svg
        .selectAll('.bar')
        .data(sortedData)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', margin.left)
        .attr('y', (d) => yScale(d.idx.toString()) ?? 0)
        .attr('width', (d) => xScale(d.value) - margin.left)
        .attr('height', yScale.bandwidth())
        .attr('fill', color)
        .on('mouseover', (event, d) => {
          // Show tooltip on mouseover
          tooltip
            .style('left', `${event.pageX + 5}px`)
            .style('top', `${event.pageY + 5}px`)
            .style('display', 'block')
            .html(
              `<strong>Idx:</strong> ${d.idx}<br>` +
              `<strong>Name:</strong> ${d.field}<br>` +
              `<strong>Value:</strong> ${d.value}`
            );
        })
        .on('mouseout', () => {
          // Hide tooltip on mouseout
          tooltip.style('display', 'none');
        });
    };
    
  
    renderBarChart('#zero-bar-chart', zeroData, 'blue');
  };
  
  const updateSharpBarChart = (sortOrder: 'desc' | 'original' = 'original') => {
    const indexedFields = targetFields.map((field, idx) => ({ idx: idx + 1, field }));
  
    const sharpData = indexedFields.map((field) => ({
      ...field,
      value: sharpChangeAnomalies.filter((a) => a.field === field.field && withinBrush(a.timestamp)).length,
    }));
  
    const renderBarChart = (
      id: string,
      data: { idx: number; field: string; value: number }[],
      color: string
    ) => {
      let sortedData = [...data];
      if (sortOrder === 'desc') {
        sortedData.sort((a, b) => b.value - a.value);
      }
    
      const dynamicHeight = margin.top + margin.bottom + sortedData.length * 20;
      const svg = d3.select(id).attr('width', chartSize.width).attr('height', dynamicHeight);
    
      svg.selectAll('*').remove();
    
      const yScale = d3
        .scaleBand()
        .domain(sortedData.map((d) => d.idx.toString()))
        .range([margin.top, dynamicHeight - margin.bottom])
        .padding(0.15);
    
      const xScale = d3
        .scaleLinear()
        .domain([0, d3.max(sortedData, (d) => d.value) || 0])
        .range([margin.left, chartSize.width - margin.right]);
    
      const xAxis = d3.axisBottom(xScale).ticks(5);
      const yAxis = d3.axisLeft(yScale);
    
      svg
        .append('g')
        .attr('transform', `translate(0, ${dynamicHeight - margin.bottom})`)
        .call(xAxis);
    
      svg
        .append('g')
        .attr('transform', `translate(${margin.left}, 0)`)
        .call(yAxis);
    
      const tooltip = d3.select('#tooltip'); // Tooltip element
    
      svg
        .selectAll('.bar')
        .data(sortedData)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', margin.left)
        .attr('y', (d) => yScale(d.idx.toString()) ?? 0)
        .attr('width', (d) => xScale(d.value) - margin.left)
        .attr('height', yScale.bandwidth())
        .attr('fill', color)
        .on('mouseover', (event, d) => {
          // Show tooltip on mouseover
          tooltip
            .style('left', `${event.pageX + 5}px`)
            .style('top', `${event.pageY + 5}px`)
            .style('display', 'block')
            .html(
              `<strong>Idx:</strong> ${d.idx}<br>` +
              `<strong>Name:</strong> ${d.field}<br>` +
              `<strong>Value:</strong> ${d.value}`
            );
        })
        .on('mouseout', () => {
          // Hide tooltip on mouseout
          tooltip.style('display', 'none');
        });
    };
    
  
    renderBarChart('#sharp-bar-chart', sharpData, 'red');
  };
  
// Event handlers for sorting
const handleSortZero = (sortOrder: 'desc' | 'original') => {
  updateZeroBarChart(sortOrder); // Only update the Zero Value Bar Chart
};

const handleSortSharp = (sortOrder: 'desc' | 'original') => {
  updateSharpBarChart(sortOrder); // Only update the Sharp Change Bar Chart
};

  

  const withinBrush = (timestamp: string) => {
    const date = new Date(timestamp);
    return (!brushStart || date >= brushStart) && (!brushEnd || date <= brushEnd);
  };  

  const handleSearchClick = () => {
    const idx = parseInt(searchValue, 10);
    setSearchIdx(idx);
    document.getElementById(`field-${idx}`)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Section: Timeline */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: '#fff',
          marginBottom: '10px',
          alignItems: 'center', // Center horizontally
          justifyContent: 'center', // Center vertically
          height: '150px', // Set a fixed height for the timeline area
        }}
      >
        <div
          id="selected-time-range"
          style={{
            marginBottom: '10px',
            textAlign: 'center',
            fontSize: '0.9rem',
            fontWeight: 'bold',
          }}
        >
          Selected Time: {selectedTimeText}
        </div>

        <svg id="timeline" width="80%" height="80%"></svg>
      </div>
  
      {/* Main Content Section */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Section: Dictionary and Search */}
        <div
          style={{
            flex: 1,
            borderRight: '1px solid #ccc',
            position: 'relative', // Allows for fixed positioning of child elements
          }}
        >
          {/* Fixed Search Input */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              backgroundColor: '#f9f9f9',
              zIndex: 10,
              borderBottom: '1px solid #ccc',
              padding: '10px',
            }}
          >
            <input
              type="number"
              placeholder="Search idx"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{ padding: '5px', fontSize: '14px', marginRight: '10px' }}
            />
            <button onClick={handleSearchClick} style={{ padding: '5px 10px', fontSize: '14px' }}>
              Search
            </button>
          </div>
  
          {/* Scrollable Dictionary */}
          <div
            id="field-mapping"
            style={{
              backgroundColor: '#f9f9f9',
              padding: '10px',
              marginTop: '10px',
              overflowY: 'scroll',
              height: 'calc(100% - 50px)', // Adjust height to fit under the search bar
            }}
          >
            <strong>Field Mapping:</strong>
            <div>
              {targetFields.map((field, idx) => (
                <div key={idx} id={`field-${idx + 1}`}>
                  {`${idx + 1}: ${field}`}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar Charts Section */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
{/* Zero Value Bar Chart */}
<div
  id="zero-bar-container"
  style={{
    flex: 1,
    overflowY: 'scroll',
    height: '300px',
    borderBottom: '1px solid #ccc',
    padding: '10px',
    position: 'relative',
  }}
>
  <h4 style={{ marginBottom: '20px' }}>Zero Value Anomalies</h4>
  {/* Buttons Section */}
  <div
    style={{
      position: 'absolute',
      top: '60px', // Adjust this value to place the buttons below the title
      left: '10px',
      zIndex: 10,
      display: 'flex',
      gap: '10px', // Adds space between buttons
    }}
  >
    <button onClick={() => updateZeroBarChart('desc')}>Sort Desc</button>
    <button onClick={() => updateZeroBarChart('original')}>Reset</button>
  </div>
  <svg id="zero-bar-chart"></svg>
</div>

{/* Sharp Change Bar Chart */}
<div
  id="sharp-bar-container"
  style={{
    flex: 1,
    overflowY: 'scroll',
    padding: '10px',
    position: 'relative',
  }}
>
  <h4 style={{ marginBottom: '20px' }}>Sharp Change Anomalies</h4>
  {/* Buttons Section */}
  <div
    style={{
      position: 'absolute',
      top: '60px', // Adjust this value to place the buttons below the title
      left: '10px',
      zIndex: 10,
      display: 'flex',
      gap: '10px', // Adds space between buttons
    }}
  >
    <button onClick={() => updateSharpBarChart('desc')}>Sort Desc</button>
    <button onClick={() => updateSharpBarChart('original')}>Reset</button>
  </div>
  <svg id="sharp-bar-chart"></svg>
</div>

        </div>
      </div>
  
      {/* Tooltip */}
      <div
        id="tooltip"
        style={{
          position: 'absolute',
          display: 'none',
          padding: '5px',
          background: '#fff',
          border: '1px solid #ccc',
          borderRadius: '4px',
          pointerEvents: 'none',
        }}
      ></div>
    </div>
  );
  
}
