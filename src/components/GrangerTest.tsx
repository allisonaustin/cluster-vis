import React, { useEffect, useState } from 'react';
import * as d3 from 'd3';

export default function GrangerTestMatrix() {
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
        
                // Load Granger test data
                const grangerData = await d3.csv('../../data/grangerTest_new.csv').then((data) =>
                    data.map((row) => ({
                        field1: row.Field1 || '',
                        field2: row.Field2 || '',
                        lag: +row.Lag || 0,
                        pValue: +row['P-Value'] || 1,
                    }))
                );
                setMatrixData(grangerData);
                setOriginalMatrixData(grangerData);
                setSortedMatrixData([...grangerData].sort((a, b) => a.pValue - b.pValue));
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
            relationshipCounts[d.field1] = (relationshipCounts[d.field1] || 0) + 1;
            relationshipCounts[d.field2] = (relationshipCounts[d.field2] || 0) + 1;
        });
    
        // Convert to array and sort by count
        const sortedCounts = Object.entries(relationshipCounts)
            .map(([field, count]) => ({ field, count }))
            .sort((a, b) => b.count - a.count);
    
        setSortedMatrixData(sortedCounts);
    };
    
    

    // const renderMatrix = (data: any[], isSorted = false) => {
    //     const svg = d3
    //         .select('#matrix')
    //         .attr('width', size.width)
    //         .attr('height', size.height)
    //         .attr('viewBox', `0 0 ${size.width} ${size.height}`)
    //         .attr('preserveAspectRatio', 'xMidYMid meet');
    
    //     svg.selectAll('*').remove();
    
    //     const displayFieldOrder = isSorted
    //         ? Array.from(new Set(data.flatMap((d) => [d.field1, d.field2])))
    //         : targetFields;
    
    //     const reorderedFieldIndices = displayFieldOrder.map((field) => ({
    //         name: field,
    //         originalIdx: targetFields.indexOf(field) + 1,
    //     }));
    
    //     const xScale = d3
    //         .scaleBand()
    //         .domain(reorderedFieldIndices.map((d) => d.originalIdx.toString()))
    //         .range([margin.left, size.width - margin.right])
    //         .padding(0.1);
    
    //     const yScale = d3
    //         .scaleBand()
    //         .domain(reorderedFieldIndices.map((d) => d.originalIdx.toString()))
    //         .range([margin.top, size.height - margin.bottom])
    //         .padding(0.1);
    
    //     // Use a logarithmic color scale for P-values
    //     const logScale = d3
    //         .scaleSequential(d3.interpolateBlues)
    //         .domain([100, Math.log10(1e-314)]);
    
    //     svg.selectAll('.cell')
    //         .data(data)
    //         .join('rect')
    //         .attr('class', 'cell')
    //         .attr('x', (d) => {
    //             const idx = reorderedFieldIndices.find((f) => f.name === d.field2)?.originalIdx || 0;
    //             return xScale(idx.toString()) ?? 0;
    //         })
    //         .attr('y', (d) => {
    //             const idx = reorderedFieldIndices.find((f) => f.name === d.field1)?.originalIdx || 0;
    //             return yScale(idx.toString()) ?? 0;
    //         })
    //         .attr('width', xScale.bandwidth())
    //         .attr('height', yScale.bandwidth())
    //         .attr('fill', (d) => logScale(Math.log10(d.pValue))) // Apply color scale
    //         .on('mouseover', (event, d) => {
    //             const tooltip = d3.select('#tooltip');
            
    //             // Set initial content and position
    //             tooltip
    //                 .style('left', `${event.pageX + 5}px`)
    //                 .style('top', `${event.pageY + 5}px`)
    //                 .style('display', 'block')
    //                 .html(
    //                     `<strong>Field1:</strong> ${d.field1} (Idx: ${targetFields.indexOf(d.field1) + 1})<br>` +
    //                     `<strong>Field2:</strong> ${d.field2} (Idx: ${targetFields.indexOf(d.field2) + 1})<br>` +
    //                     `<strong>Lag:</strong> ${d.lag}<br>` +
    //                     `<strong>P-Value:</strong> ${d.pValue.toExponential(2)}`
    //                 );
            
    //             // Get tooltip node and ensure it's not null
    //             const tooltipNode = tooltip.node() as HTMLElement | null;
            
    //             if (tooltipNode) {
    //                 const tooltipWidth = tooltipNode.offsetWidth;
    //                 const tooltipHeight = tooltipNode.offsetHeight;
            
    //                 // Get viewport dimensions
    //                 const viewportWidth = window.innerWidth;
    //                 const viewportHeight = window.innerHeight;
            
    //                 // Adjust tooltip position if it exceeds boundaries
    //                 let left = event.pageX + 5;
    //                 let top = event.pageY + 5;
            
    //                 if (left + tooltipWidth > viewportWidth) {
    //                     left = event.pageX - tooltipWidth - 5; // Move left if it exceeds right boundary
    //                 }
    //                 if (top + tooltipHeight > viewportHeight) {
    //                     top = event.pageY - tooltipHeight - 5; // Move up if it exceeds bottom boundary
    //                 }
            
    //                 tooltip.style('left', `${left}px`).style('top', `${top}px`);
    //             }
    //         })
    //         .on('mouseout', () => {
    //             d3.select('#tooltip').style('display', 'none');
    //         });
            
    
    //     // X-axis
    //     svg.append('g')
    //         .attr('transform', `translate(0, ${size.height - margin.bottom})`)
    //         .call(
    //             d3.axisBottom(xScale).tickFormat((d) => {
    //                 const field = reorderedFieldIndices.find((f) => f.originalIdx.toString() === d);
    //                 return field ? `${field.originalIdx}` : '';
    //             })
    //         )
    //         .selectAll('text')
    //         .style('text-anchor', 'end')
    //         .attr('dx', '-0.8em')
    //         .attr('dy', '0.15em')
    //         .attr('transform', 'rotate(-45)');
    
    //     // Y-axis
    //     svg.append('g')
    //         .attr('transform', `translate(${margin.left}, 0)`)
    //         .call(
    //             d3.axisLeft(yScale).tickFormat((d) => {
    //                 const field = reorderedFieldIndices.find((f) => f.originalIdx.toString() === d);
    //                 return field ? `${field.originalIdx}` : '';
    //             })
    //         );
    // };
    
    // Sorting Logic
    
    const renderMatrix = (data: any[], isSorted = false) => {
        const svg = d3
            .select('#matrix')
            .attr('width', size.width + margin.right) // Adjust for legend space
            .attr('height', size.height)
            .attr('viewBox', `0 0 ${size.width + margin.right} ${size.height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');
    
        svg.selectAll('*').remove();
    
        const displayFieldOrder = isSorted
            ? Array.from(new Set(data.flatMap((d) => [d.field1, d.field2])))
            : targetFields;
    
        const reorderedFieldIndices = displayFieldOrder.map((field) => ({
            name: field,
            originalIdx: targetFields.indexOf(field) + 1,
        }));
    
        const xScale = d3
            .scaleBand()
            .domain(reorderedFieldIndices.map((d) => d.originalIdx.toString()))
            .range([margin.left, size.width - margin.right])
            .padding(0.1);
    
        const yScale = d3
            .scaleBand()
            .domain(reorderedFieldIndices.map((d) => d.originalIdx.toString()))
            .range([margin.top, size.height - margin.bottom])
            .padding(0.1);
    
        // Logarithmic color scale for P-values
        const logScale = d3
            .scaleSequential(d3.interpolateBlues)
            .domain([100, Math.log10(1e-314)]);
    
        svg.selectAll('.cell')
            .data(data)
            .join('rect')
            .attr('class', 'cell')
            .attr('x', (d) => {
                const idx = reorderedFieldIndices.find((f) => f.name === d.field2)?.originalIdx || 0;
                return xScale(idx.toString()) ?? 0;
            })
            .attr('y', (d) => {
                const idx = reorderedFieldIndices.find((f) => f.name === d.field1)?.originalIdx || 0;
                return yScale(idx.toString()) ?? 0;
            })
            .attr('width', xScale.bandwidth())
            .attr('height', yScale.bandwidth())
            .attr('fill', (d) => logScale(Math.log10(d.pValue)))
            .on('mouseover', (event, d) => {
                const tooltip = d3.select('#tooltip');
                tooltip
                    .style('left', `${event.pageX + 5}px`)
                    .style('top', `${event.pageY + 5}px`)
                    .style('display', 'block')
                    .html(
                        `<strong>Field1:</strong> ${d.field1} (Idx: ${targetFields.indexOf(d.field1) + 1})<br>` +
                        `<strong>Field2:</strong> ${d.field2} (Idx: ${targetFields.indexOf(d.field2) + 1})<br>` +
                        `<strong>Lag:</strong> ${d.lag}<br>` +
                        `<strong>P-Value:</strong> ${d.pValue.toExponential(2)}`
                    );
            })
            .on('mouseout', () => {
                d3.select('#tooltip').style('display', 'none');
            });
    
        // X-axis
        svg.append('g')
            .attr('transform', `translate(0, ${size.height - margin.bottom})`)
            .call(
                d3.axisBottom(xScale).tickFormat((d) => {
                    const field = reorderedFieldIndices.find((f) => f.originalIdx.toString() === d);
                    return field ? `${field.originalIdx}` : '';
                })
            )
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-0.8em')
            .attr('dy', '0.15em')
            .attr('transform', 'rotate(-45)');
    
        // Y-axis
        svg.append('g')
            .attr('transform', `translate(${margin.left}, 0)`)
            .call(
                d3.axisLeft(yScale).tickFormat((d) => {
                    const field = reorderedFieldIndices.find((f) => f.originalIdx.toString() === d);
                    return field ? `${field.originalIdx}` : '';
                })
            );
    
        // Add vertical legend
        const legendWidth = 20;
        const legendHeight = 150;
    
        const legendX = size.width - margin.right; // Position to the right of the matrix
        const legendY = margin.top; // Align with the top margin
    
        const legendScale = d3.scaleLinear()
            .domain(logScale.domain())
            .range([legendHeight, 0]); // Vertical orientation
    
            const legendAxis = d3.axisRight(legendScale)
            .ticks(5)
            .tickFormat((d) => {
                const numericValue = Number(d); // Convert NumberValue to number
                const expValue = Math.pow(10, numericValue); // Transform back to the original p-value
                return expValue.toExponential(1); // Format as exponential
            });
        
        const defs = svg.append('defs');
        const gradientId = 'vertical-legend-gradient';
        const linearGradient = defs.append('linearGradient')
            .attr('id', gradientId)
            .attr('x1', '0%')
            .attr('y1', '100%')
            .attr('x2', '0%')
            .attr('y2', '0%'); // Vertical gradient
    
        linearGradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', logScale(100));
    
        linearGradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', logScale(Math.log10(1e-314)));
    
        svg.append('rect')
            .attr('x', legendX)
            .attr('y', legendY)
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .style('fill', `url(#${gradientId})`);
    
        svg.append('g')
            .attr('transform', `translate(${legendX + legendWidth}, ${legendY})`)
            .call(legendAxis)
            .selectAll('text')
            .style('font-size', '12px');
    };
    
    const handleSortMatrix = () => {
        const sortedMatrix = [...matrixData].sort((a, b) => a.pValue - b.pValue);
        renderMatrix(sortedMatrix, true);
    };
    
    // Reset Logic
    const handleResetMatrix = () => {
        renderMatrix(originalMatrixData, false);
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
            element.scrollIntoView({ behavior: 'smooth', block: 'center' }); // Scroll to the element
            element.classList.add('highlight'); // Add highlight class
            setTimeout(() => {
                element.classList.remove('highlight'); // Remove highlight after 2 seconds
            }, 2000); // Adjust duration as needed
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
                <div style={{ fontSize: '16px', fontWeight: 'bold', marginRight: '20px' }}>Granger Test Analysis</div>

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
                        <h4>Sorted Fields by Significant Relationships</h4>
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
                                            <span style={{ fontWeight: 'bold' }}>{`Rank ${idx + 1}:`}</span> {`${d.field} (Relationships: ${d.count})`}
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
