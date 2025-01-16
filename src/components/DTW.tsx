import React, { useEffect, useState } from 'react';
import * as d3 from 'd3';

export default function DTWMatrix() {
    const [targetFields, setTargetFields] = useState<string[]>([]);
    const [matrixData, setMatrixData] = useState<any[]>([]);
    const [originalMatrixData, setOriginalMatrixData] = useState<any[]>([]);
    const [sortedMatrixData, setSortedMatrixData] = useState<any[]>([]);
    const [searchValue, setSearchValue] = useState('');
    const [searchIdx, setSearchIdx] = useState<number | null>(null);

    const size = { width: 800, height: 800 }; // Matrix size
    const margin = { top: 50, right: 20, bottom: 65, left: 50 };

    useEffect(() => {
        const loadData = async () => {
            try {
                // Load target fields
                const targetData = await d3.csv('../../data/target_fields_new.csv').then((data) =>
                    Array.from(new Set(data.flatMap((row) => Object.keys(row).filter((key) => key !== 'timestamp'))))
                );
                setTargetFields(targetData);

                // Load DTW data
                const matrixData = await d3.csv('../../data/similar_time_series_pairs_new.csv').then((data) =>
                    data.map((row) => ({
                        field1: row.Field1!,
                        field2: row.Field2!,
                        value: +row.DTW_Distance!, // Using DTW_Distance column
                    }))
                );
                setMatrixData(matrixData);
                setOriginalMatrixData(matrixData);
                setSortedMatrixData([...matrixData].sort((a, b) => a.value - b.value)); // Sorting by distance
            } catch (error) {
                console.error('Error loading data:', error);
            }
        };

        loadData();
    }, []);

    useEffect(() => {
        if (targetFields.length && matrixData.length) {
            renderMatrix(matrixData);
        }
    }, [matrixData]);

    const renderMatrix = (data: any[], isSorted = false) => {
        const svg = d3
            .select('#matrix')
            .attr('width', size.width)
            .attr('height', size.height)
            .attr('viewBox', `0 0 ${size.width} ${size.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        svg.selectAll('*').remove();

        // Determine the field order for the current rendering
        const currentFieldOrder = isSorted
            ? Array.from(new Set(data.flatMap((d) => [d.field1, d.field2])))
            : targetFields;

        const xScale = d3
            .scaleBand()
            .domain(currentFieldOrder)
            .range([margin.left, size.width - margin.right])
            .padding(0.1);

        const yScale = d3
            .scaleBand()
            .domain(currentFieldOrder)
            .range([margin.top, size.height - margin.bottom])
            .padding(0.1);

        const colorScale = d3
            .scaleSequential(d3.interpolateGreens) // Green scale for similarity
            .domain([d3.max(data, (d) => d.value), 0]); // Invert domain to highlight smaller distances
        

        // Draw grid cells
        svg
            .selectAll('.cell')
            .data(data)
            .join('rect')
            .attr('class', 'cell')
            .attr('x', (d) => xScale(d.field2) ?? 0)
            .attr('y', (d) => yScale(d.field1) ?? 0)
            .attr('width', xScale.bandwidth())
            .attr('height', yScale.bandwidth())
            .attr('fill', (d) => colorScale(d.value))
            .on('mouseover', (event, d) => {
                const tooltip = d3.select('#tooltip');
            
                // Set initial content and position
                tooltip
                    .style('left', `${event.pageX + 5}px`)
                    .style('top', `${event.pageY + 5}px`)
                    .style('display', 'block')
                    .html(
                        `<strong>Field1 (Idx):</strong> ${d.field1} (${targetFields.indexOf(d.field1) + 1})<br>
                        <strong>Field2 (Idx):</strong> ${d.field2} (${targetFields.indexOf(d.field2) + 1})<br>
                        <strong>DTW Distance:</strong> ${d.value.toFixed(2)}`
                    );
            
                // Get tooltip node and ensure it's not null
                const tooltipNode = tooltip.node() as HTMLElement | null;
            
                if (tooltipNode) {
                    const tooltipWidth = tooltipNode.offsetWidth;
                    const tooltipHeight = tooltipNode.offsetHeight;
            
                    // Get viewport dimensions
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
            
                    // Adjust tooltip position if it exceeds boundaries
                    let left = event.pageX + 5;
                    let top = event.pageY + 5;
            
                    if (left + tooltipWidth > viewportWidth) {
                        left = event.pageX - tooltipWidth - 5; // Move left if it exceeds the right boundary
                    }
                    if (top + tooltipHeight > viewportHeight) {
                        top = event.pageY - tooltipHeight - 5; // Move up if it exceeds the bottom boundary
                    }
            
                    tooltip.style('left', `${left}px`).style('top', `${top}px`);
                }
            })
            .on('mouseout', () => {
                d3.select('#tooltip').style('display', 'none');
            });
            

        // Draw x-axis with original idx mapping
        svg
            .append('g')
            .attr('transform', `translate(0, ${size.height - margin.bottom})`)
            .call(d3.axisBottom(xScale).tickFormat((d) => `${targetFields.indexOf(d) + 1}`))
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-0.8em')
            .attr('dy', '0.15em')
            .attr('transform', 'rotate(-45)');

        // Draw y-axis with original idx mapping
        svg
            .append('g')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(d3.axisLeft(yScale).tickFormat((d) => `${targetFields.indexOf(d) + 1}`));

        // Legend dimensions
        const legendWidth = 20;
        const legendHeight = 150;

        const legendX = size.width - margin.right; // Position to the right of the matrix
        const legendY = margin.top; // Align with the top margin

        // Legend scale
        const legendScale = d3.scaleLinear()
            .domain(colorScale.domain()) // Use the same domain as colorScale
            .range([legendHeight, 0]); // Vertical orientation

        const legendAxis = d3.axisRight(legendScale)
            .ticks(5)
            .tickFormat((d) => {
                const numericValue = Number(d); // Convert NumberValue to number
                return numericValue.toExponential(1); // Format in scientific notation with 1 decimal place
            });
        
        

        // Define the gradient for the legend
        const defs = svg.append('defs');
        const gradientId = 'vertical-legend-gradient';
        const linearGradient = defs.append('linearGradient')
            .attr('id', gradientId)
            .attr('x1', '0%')
            .attr('y1', '100%') // Start gradient at the bottom
            .attr('x2', '0%')
            .attr('y2', '0%'); // End gradient at the top

        // Gradient stops
        linearGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', colorScale(d3.max(data, (d) => d.value) ?? 1)); // Lightest color for largest DTW distance

        linearGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', colorScale(0)); // Darkest color for smallest DTW distance

        // Draw the gradient rectangle
        svg.append('rect')
            .attr('x', legendX)
            .attr('y', legendY)
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .style('fill', `url(#${gradientId})`);

        // Add the legend axis
        svg.append('g')
            .attr('transform', `translate(${legendX + legendWidth}, ${legendY})`)
            .call(legendAxis)
            .selectAll('text')
            .style('font-size', '12px');
        };

        const handleSortMatrix = () => {
            const sortedMatrix = [...matrixData].sort((a, b) => a.value - b.value); // Sort by ascending distance
            setSortedMatrixData(sortedMatrix); // Update the sorted matrix data for the sorted list
            renderMatrix(sortedMatrix, true); // Render the matrix with the new order
        };

    const handleResetMatrix = () => {
        renderMatrix(originalMatrixData); // Render original matrix without modifying the order
    };

    const handleSearchClick = () => {
        const idx = parseInt(searchValue, 10);
        setSearchIdx(idx);
    
        // Highlight the dictionary entry
        const dictionaryElement = document.getElementById(`field-${idx}`);
        if (dictionaryElement) {
            dictionaryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            dictionaryElement.classList.add('highlight'); // Add highlight class
            setTimeout(() => {
                dictionaryElement.classList.remove('highlight'); // Remove highlight after 2 seconds
            }, 2000);
        }
    
        // Highlight the corresponding matrix cells
        const svg = d3.select('#matrix');
        svg.selectAll('.cell')
            .filter(
                (d: any) =>
                    d.field1 === targetFields[idx - 1] || d.field2 === targetFields[idx - 1]
            )
            .classed('highlight-cell', true) // Add highlight class
            .transition()
            .duration(2000)
            .on('end', function () {
                d3.select(this).classed('highlight-cell', false); // Remove highlight class after 2 seconds
            });
    };    

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    position: 'sticky',
                    top: 0,
                    backgroundColor: '#fff',
                    zIndex: 10,
                    padding: '10px',
                }}
            >
                {/* Title Section */}
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginRight: '20px' }}>
                    Dynamic Time Warping Analysis
                </div>

                {/* Search and Controls Section */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
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
                    <button onClick={handleSortMatrix} style={{ padding: '5px 10px', fontSize: '14px', marginLeft: '10px' }}>
                        Sort Matrix
                    </button>
                    <button onClick={handleResetMatrix} style={{ padding: '5px 10px', fontSize: '14px', marginLeft: '10px' }}>
                        Reset Matrix
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
                {/* Dictionary Section */}
                <div
                    style={{
                        flex: 1,
                        borderRight: '1px solid #ccc',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* Upper Part: Dictionary */}
                    <div style={{ flex: 1, overflowY: 'scroll', padding: '10px', backgroundColor: '#f9f9f9' }}>
                        <h4>Field Dictionary</h4>
                        <div>
                            {targetFields.map((field, idx) => (
                                <div key={idx} id={`field-${idx + 1}`}>
                                    {`${idx + 1}: ${field}`}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Lower Part: Sorted Distances */}
                    <div style={{ flex: 1, overflowY: 'scroll', padding: '10px', backgroundColor: '#eef1f5' }}>
                        <h4>Sorted Distances</h4>
                        <div>
                            {sortedMatrixData.map((d, idx) => {
                                const idx1 = targetFields.findIndex((field) => field === d.field1) + 1;
                                const idx2 = targetFields.findIndex((field) => field === d.field2) + 1;
                                return (
                                    <div key={idx}>
                                        <span style={{ fontWeight: 'bold' }}>{`Rank ${idx + 1}:`}</span> {`${idx1} - ${idx2} (DTW: ${d.value.toFixed(2)})`}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>

                {/* Matrix Section */}
                <svg id="matrix" style={{ flex: 2 }}></svg>
            </div>

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
