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

interface CombinedData {
    idx: number;
    field: string;
    zeroValue: number;
    sharpChange: number;
    normalizedZero: number;
    normalizedSharp: number;
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

    useEffect(() => {
        if (!targetFields.length || (!zeroValueAnomalies.length && !sharpChangeAnomalies.length)) return;
    
        // Initialize the timeline
        initTimeline();
    
        // Initialize or update the Bidirectional Bar Chart
        updateBidirectionalBarChart('original', 'zero'); // Initialize for zero-value anomalies
        updateBidirectionalBarChart('original', 'sharp'); // Initialize for sharp-change anomalies
    }, [targetFields, zeroValueAnomalies, sharpChangeAnomalies]); // Run only when data changes

    useEffect(() => {
        if (brushStart && brushEnd) {
            updateBidirectionalBarChart('original', 'zero'); // Update chart for zero anomalies
            updateBidirectionalBarChart('original', 'sharp'); // Update chart for sharp anomalies
        }
    }, [brushStart, brushEnd]);

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

    const updateBidirectionalBarChart = (
        sortOrder: 'desc' | 'original',
        type: 'zero' | 'sharp'
    ) => {
        const indexedFields = targetFields.map((field, idx) => ({ idx: idx + 1, field }));
    
        const zeroData = indexedFields.map((field) => ({
            ...field,
            value: zeroValueAnomalies.filter((a) => a.field === field.field && withinBrush(a.timestamp))
                .length,
        }));
    
        const sharpData = indexedFields.map((field) => ({
            ...field,
            value: sharpChangeAnomalies.filter((a) => a.field === field.field && withinBrush(a.timestamp))
                .length,
        }));
    
        // Combine data with initial normalization properties
        let combinedData: CombinedData[] = indexedFields.map((field, idx) => ({
            idx: field.idx,
            field: field.field,
            zeroValue: zeroData[idx]?.value || 0,
            sharpChange: sharpData[idx]?.value || 0,
            normalizedZero: 0, // Placeholder for normalization
            normalizedSharp: 0, // Placeholder for normalization
        }));
    
        // Normalize the values for visualization
        const maxZero = Math.max(...combinedData.map((d) => d.zeroValue), 1);
        const maxSharp = Math.max(...combinedData.map((d) => d.sharpChange), 1);
    
        combinedData = combinedData.map((d) => ({
            ...d,
            normalizedZero: d.zeroValue / maxZero,
            normalizedSharp: d.sharpChange / maxSharp,
        }));
    
        // Sort data based on type and order
        if (sortOrder === 'desc') {
            if (type === 'zero') {
                combinedData.sort((a, b) => b.zeroValue - a.zeroValue);
            } else if (type === 'sharp') {
                combinedData.sort((a, b) => b.sharpChange - a.sharpChange);
            }
        }
    
        const dynamicHeight = margin.top + margin.bottom + combinedData.length * 20;
        const svg = d3
            .select('#bidirectional-bar-chart')
            .attr('width', chartSize.width)
            .attr('height', dynamicHeight);
    
        svg.selectAll('*').remove();
    
        // Update y-axis based on sorted order
        const yScale = d3
        .scaleBand()
            .domain(combinedData.map((d) => d.idx.toString()))
            .range([margin.top, dynamicHeight - margin.bottom])
            .padding(0.15);
    
        const xScale = d3
            .scaleLinear()
            .domain([-1, 1]) // Normalized range for both types
            .range([margin.left, chartSize.width - margin.right]);
    
        const xAxis = d3.axisBottom(xScale).ticks(5);
        const yAxis = d3.axisLeft(yScale);
    
        svg
        .append('g')
        .attr('transform', `translate(0, ${dynamicHeight - margin.bottom})`)
        .call(xAxis);
    
        svg.append('g').attr('transform', `translate(${margin.left}, 0)`).call(yAxis);
    
        const tooltip = d3.select('#tooltip');
    
        // Add bars for zero-value anomalies (right side)
        svg
        .selectAll('.zero-bar')
        .data(combinedData)
        .join('rect')
        .attr('class', 'zero-bar')
        .attr('x', xScale(0))
        .attr('y', (d) => yScale(d.idx.toString()) ?? 0)
        .attr('width', (d) => xScale(d.normalizedZero) - xScale(0))
        .attr('height', yScale.bandwidth())
        .attr('fill', 'blue')
        .on('mouseover', (event, d) => {
            tooltip
            .style('left', `${event.pageX + 5}px`)
            .style('top', `${event.pageY + 5}px`)
            .style('display', 'block')
            .html(
                `<strong>Idx:</strong> ${d.idx}<br>` +
                `<strong>Field:</strong> ${d.field}<br>` +
                `<strong>Zero Value Count:</strong> ${d.zeroValue} (Scaled: ${d.normalizedZero.toFixed(
                2
                )})<br>` +
                `<strong>Sharp Change Count:</strong> ${d.sharpChange} (Scaled: ${d.normalizedSharp.toFixed(
                2
                )})`
            );
        }) 
        .on('mouseout', () => tooltip.style('display', 'none'));
    
        // Add bars for sharp change anomalies (left side)
        svg
        .selectAll('.sharp-bar')
        .data(combinedData)
        .join('rect')
        .attr('class', 'sharp-bar')
        .attr('x', (d) => xScale(-d.normalizedSharp))
        .attr('y', (d) => yScale(d.idx.toString()) ?? 0)
        .attr('width', (d) => xScale(0) - xScale(-d.normalizedSharp))
        .attr('height', yScale.bandwidth())
        .attr('fill', 'red')
        .on('mouseover', (event, d) => {
            tooltip
            .style('left', `${event.pageX + 5}px`)
            .style('top', `${event.pageY + 5}px`)
            .style('display', 'block')
            .html(
                `<strong>Idx:</strong> ${d.idx}<br>` +
                `<strong>Field:</strong> ${d.field}<br>` +
                `<strong>Zero Value Count:</strong> ${d.zeroValue} (Scaled: ${d.normalizedZero.toFixed(
                2
                )})<br>` +
                `<strong>Sharp Change Count:</strong> ${d.sharpChange} (Scaled: ${d.normalizedSharp.toFixed(
                2
                )})`
            );
        })      
        .on('mouseout', () => tooltip.style('display', 'none'));
    };

// Event handlers for sorting
    const handleSort = (sortOrder: 'desc' | 'original', type?: 'zero' | 'sharp') => {
        if (type) {
            updateBidirectionalBarChart(sortOrder, type); // Sort for specific anomaly type
        } else {
            // Reset both anomaly types
            updateBidirectionalBarChart('original', 'zero');
            updateBidirectionalBarChart('original', 'sharp');
        }
    };

    const withinBrush = (timestamp: string) => {
        const date = new Date(timestamp);
        return (!brushStart || date >= brushStart) && (!brushEnd || date <= brushEnd);
    };  

    const handleSearchClick = () => {
        const idx = parseInt(searchValue, 10);
        if (isNaN(idx)) return;
    
        setSearchIdx(idx); // Update the search index
    
        // Locate and scroll to the bar
        locateBar('#bidirectional-bar-container', '#bidirectional-bar-chart', idx);
    
        // Temporarily highlight the corresponding bar
        highlightBar('#bidirectional-bar-chart', idx);
    
        // Locate and highlight the corresponding dictionary entry
        const dictionaryEntry = document.getElementById(`field-${idx}`);
        if (dictionaryEntry) {
            dictionaryEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
            dictionaryEntry.style.backgroundColor = '#ffeb3b'; // Temporarily highlight with yellow
            setTimeout(() => {
                dictionaryEntry.style.backgroundColor = ''; // Remove highlight after 1 second
            }, 2000);
        }
    };
    // Locate a specific bar and scroll to its position
    const locateBar = (containerId: string, chartId: string, idx: number) => {
        const container = document.querySelector(containerId) as HTMLElement | null;
        const targetBar = d3
            .selectAll<SVGRectElement, { idx: number }>(`${chartId} .zero-bar, ${chartId} .sharp-bar`)
            .filter((d) => d.idx === idx)
            .node();
        
        if (container && targetBar) {
            const containerRect = container.getBoundingClientRect();
            const barRect = targetBar.getBoundingClientRect();
        
            // Calculate the position relative to the container
            const offset =
            barRect.top - containerRect.top + container.scrollTop - container.clientHeight / 2;
        
            // Smooth scroll to the calculated position
            container.scrollTo({ top: offset, behavior: 'smooth' });
        }
    };
    
    // Highlight the bar based on the search index
    const highlightBar = (chartId: string, idx: number | null) => {
        const zeroBars = d3.selectAll<SVGRectElement, { idx: number }>(`${chartId} .zero-bar`);
        const sharpBars = d3.selectAll<SVGRectElement, { idx: number }>(`${chartId} .sharp-bar`);
    
        // Highlight the corresponding bar
        zeroBars.attr('fill', (d) => (d.idx === idx ? 'lightblue' : 'blue')); // Highlight zero bars
        sharpBars.attr('fill', (d) => (d.idx === idx ? 'lightcoral' : 'red')); // Highlight sharp bars
    
        // Reset the highlight after 2 seconds
        setTimeout(() => {
            zeroBars.attr('fill', 'blue'); // Reset to original color
            sharpBars.attr('fill', 'red'); // Reset to original color
        }, 2000);
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
        <div
        id="bidirectional-bar-container"
        style={{
            flex: 1,
            overflowY: 'scroll',
            padding: '10px',
            position: 'relative',
        }}
        >
        <h4 style={{ marginBottom: '20px' }}>Bidirectional Anomaly Bar Chart</h4>
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
        <button onClick={() => handleSort('desc', 'zero')}>Sort Zero Desc</button>
        <button onClick={() => handleSort('desc', 'sharp')}>Sort Sharp Desc</button>
        <button onClick={() => handleSort('original')}>Reset</button>
        </div>
        <svg id="bidirectional-bar-chart"></svg>
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
