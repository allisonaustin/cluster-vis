import React, { useEffect, useState } from 'react';
import * as d3 from 'd3';

export default function CoIntegrationMatrix() {
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
    
                // Load co-integration data
                const matrixData = await d3.csv('../../data/cointegration_results_new.csv').then((data) =>
                    data.map((row) => {
                        const score = +row.Score!;
                        const isInf = row.Score === '-inf'; // Check for -inf explicitly
                        return {
                            field1: row.Field1!,
                            field2: row.Field2!,
                            value: isInf ? Number.NEGATIVE_INFINITY : score, // Treat -inf correctly
                            pValue: +row['P-Value']!,
                            significant: +row['P-Value']! <= 0.01,
                        };
                    })
                );
                setMatrixData(matrixData);
                setOriginalMatrixData(matrixData);
    
                // Sort, placing -inf at the top
                setSortedMatrixData(
                    [...matrixData].sort((a, b) =>
                        a.value === Number.NEGATIVE_INFINITY ? -1 : b.value === Number.NEGATIVE_INFINITY ? 1 : a.value - b.value
                    )
                );
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

    useEffect(() => {
        if (matrixData.length > 0) {
            calculateSignificantRelationships();
        }
    }, [matrixData]);

    const calculateSignificantRelationships = () => {
        const relationshipCounts: Record<string, number> = {};
    
        // Count significant relationships for each field
        matrixData.forEach((d) => {
            if (d.significant) {
                relationshipCounts[d.field1] = (relationshipCounts[d.field1] || 0) + 1;
                relationshipCounts[d.field2] = (relationshipCounts[d.field2] || 0) + 1;
            }
        });
    
        // Convert to array and sort by count
        const sortedCounts = Object.entries(relationshipCounts)
            .map(([field, count]) => ({ field, count }))
            .sort((a, b) => b.count - a.count);
    
        setSortedMatrixData(sortedCounts);
    };    
    

    const renderMatrix = (data: any[], isSorted = false) => {
        const svg = d3
            .select('#matrix')
            .attr('width', size.width)
            .attr('height', size.height)
            .attr('viewBox', `0 0 ${size.width} ${size.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        svg.selectAll('*').remove();

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
            .scaleSequential((t) => d3.interpolateGreens(1 - t)) // Reverse interpolation for better visualization
            .domain([-50, 0]); // Assume -50 as the limit before -inf
        

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
            .attr('stroke', (d) => (d.significant ? 'red' : 'none')) // Highlight significant cells
            .attr('stroke-width', (d) => (d.significant ? 2 : 0))
            .on('mouseover', (event, d) => {
                const tooltip = d3.select('#tooltip');
            
                // Set initial content and position
                const valueText = d.value === Number.NEGATIVE_INFINITY ? '-inf' : d.value.toFixed(2);
                tooltip
                    .style('left', `${event.pageX + 5}px`)
                    .style('top', `${event.pageY + 5}px`)
                    .style('display', 'block')
                    .html(
                        `<strong>Field1:</strong> ${d.field1} (Idx: ${targetFields.indexOf(d.field1) + 1})<br>
                         <strong>Field2:</strong> ${d.field2} (Idx: ${targetFields.indexOf(d.field2) + 1})<br>
                         <strong>Score:</strong> ${valueText}<br>
                         <strong>P-Value:</strong> ${d.pValue.toExponential(2)}`
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
            

        // Draw x-axis
        svg
            .append('g')
            .attr('transform', `translate(0, ${size.height - margin.bottom})`)
            .call(d3.axisBottom(xScale).tickFormat((d) => `${targetFields.indexOf(d) + 1}`))
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-0.8em')
            .attr('dy', '0.15em')
            .attr('transform', 'rotate(-45)');

        // Draw y-axis
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

        // Legend axis
        const legendAxis = d3.axisRight(legendScale)
        .ticks(5) // Number of ticks
        .tickFormat((d) => {
            const numericValue = Number(d); // Convert NumberValue to number
            if (numericValue === -50) return '-inf'; // Special case for -inf
            return numericValue.toFixed(1); // Format other values to 1 decimal place
        });


        // Define the gradient for the legend
        const defs = svg.append('defs');
        const gradientId = 'vertical-legend-gradient';
        const linearGradient = defs.append('linearGradient')
            .attr('id', gradientId)
            .attr('x1', '0%')
            .attr('y1', '0%') // Darkest color at the top
            .attr('x2', '0%')
            .attr('y2', '100%'); // Lightest color at the bottom


        // Gradient stops
        linearGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', colorScale(-50)); // Darkest color for -inf

        linearGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', colorScale(0)); // Lightest color for 0

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
        const sortedMatrix = [...matrixData].sort((a, b) =>
            a.value === Number.NEGATIVE_INFINITY ? -1 : b.value === Number.NEGATIVE_INFINITY ? 1 : a.value - b.value
        );
        renderMatrix(sortedMatrix, true);
    };
    

    const handleResetMatrix = () => {
        renderMatrix(originalMatrixData);
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

    const handleScrollAndHighlight = (dictionaryIdx: number) => {
        const element = document.getElementById(`field-${dictionaryIdx}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' }); // Smooth scroll
            element.classList.add('highlight'); // Add highlight class
            setTimeout(() => {
                element.classList.remove('highlight'); // Remove highlight after 2 seconds
            }, 2000);
        }
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
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginRight: '20px' }}>
                    Co-Integration Analysis
                </div>

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
                <div
                    style={{
                        flex: 1,
                        borderRight: '1px solid #ccc',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
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

                    <div style={{ flex: 1, overflowY: 'scroll', padding: '10px', backgroundColor: '#eef1f5' }}>
                        <h4>Fields by Significant Relationships</h4>
                        <div>
                            {sortedMatrixData.map((d, idx) => {
                                const dictionaryIdx = targetFields.indexOf(d.field) + 1; // Get corresponding dictionary index
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => handleScrollAndHighlight(dictionaryIdx)} // Add click handler
                                        style={{
                                            cursor: 'pointer',
                                        }}
                                        className="rank-item"
                                    >
                                        <span style={{ fontWeight: 'bold' }}>{`Rank ${idx + 1}:`}</span> {`${d.field} (Significant Relationships: ${d.count})`}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
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
