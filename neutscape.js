// Function for parsing Newick files
function parseNewick(s) {
    let ancestors = [];
    let tree = {};
    let tokens = s.split(/\s*(;|\(|\)|,|:)\s*/);
    for (let i = 0; i < tokens.length; i++) {
      let token = tokens[i];
      let subtree = {};
      switch (token) {
        case '(': // new branchset
          tree.branchset = [subtree];
          ancestors.push(tree);
          tree = subtree;
          break;
        case ',': // another branch
          ancestors[ancestors.length - 1].branchset.push(subtree);
          tree = subtree;
          break;
        case ')': // optional name next
          tree = ancestors.pop();
          break;
        case ':': // optional length next
          break;
        default:
          let x = tokens[i - 1];
          if (x == ')' || x == '(' || x == ',') {
            tree.name = token;
          } else if (x == ':') {
            tree.length = parseFloat(token);
          }
      }
    }
    return tree;
  }

// Load and process data
Promise.all([
    d3.csv('umap.csv'),
    d3.text('tree.nwk'),
    d3.csv('titers.csv'),
  ]).then(([umapData, treeData, titersData]) => {
    // Process tree data
    const root = parseNewick(treeData);
    const tree = d3.cluster().size([400, 400])(d3.hierarchy(root, d => d.branchset));
    
    // Get an array of all ic50 values across all samples
    const allIc50s = titersData.map(d => +d.ic50);

    // Compute the extent of all ic50 values
    const ic50Extent = d3.extent(allIc50s);
    
    // Define your color scale using the overall ic50 extent
    const nodeColor = d3.scaleSequential()
        .domain(ic50Extent)
        .interpolator(d3.interpolateViridis);
  
    // Generate Phylogenetic tree
    const treeSvg = d3.select('#phylogram').append('svg')
        .attr('viewBox', [-50, 0, 550, 550]);  // provide extra space for labels
  
    // Draw lines connecting nodes (adjusted to be straight)
    treeSvg.selectAll('path')
        .data(tree.links())
        .join('path')
          .attr('d', d => `M${d.source.y},${d.source.x} V${d.target.x} H${d.target.y}`)
          .attr('stroke', 'black')
          .attr('fill', 'none');
  
    // Draw nodes
    treeSvg.selectAll('circle')
    .data(tree.descendants())
    .join('circle')
    .attr('transform', d => `translate(${d.y},${d.x})`)
    .attr('r', 5.5)
    .attr('fill', '#D3D3D3')
    .attr('stroke', 'black')
    .attr('stroke-width', 0.9)
    .on('mouseover', function(event, node) {
        if (selected !== null) {
            // Show tooltip
            const titer = titersData.find(t => t.sample_name === selected.sample_name && t.virus_strain === node.data.name);
            if (titer) {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 1.0);
                tooltip.html(`Sample Name: ${selected.sample_name}<br/>Virus Strain: ${node.data.name}<br/>IC50: ${titer.ic50}`)
                    .style('left', (event.pageX) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
                // Enlarge this node
                d3.select(this)
                  .transition()
                  .duration(400)  // Adjust time in ms as needed
                  .attr('r', 10);
            }
        }
    })
    .on('mouseout', function(event, node) {
        // Hide tooltip
        tooltip.transition()
            .duration(200)
            .style('opacity', 0);
        // Restore node size
        d3.select(this)
          .transition()
          .duration(400)  // Adjust time in ms as needed
          .attr('r', 5.5);
    });

    // Add node labels
    treeSvg.selectAll('text')
        .data(tree.descendants())
        .join('text')
          .attr('transform', d => `translate(${d.y},${d.x})`)
          .attr('dy', '0.31em')
          .attr('dx', '10')  // offset label from node
          .text(d => d.data.name)
          .style('font-size', '17px');
    
    // Generate UMAP
    const umapX = d3.scaleLinear()
      .domain(d3.extent(umapData, d => +d.UMAP1))
      .range([90, 320]);  // adjust to fit in bounding box
    
    const umapY = d3.scaleLinear()
      .domain(d3.extent(umapData, d => +d.UMAP2))
      .range([320, 90]);  // adjust and invert to fit in bounding box
  
    const color = d3.scaleOrdinal(d3.schemeSet3);
  
    const umapSvg = d3.select('#umap').append('svg')
        .attr('viewBox', [0, 0, 500, 500]);
  
    // Draw bounding box and axes
    umapSvg.append('rect')
      .attr('x', 50)
      .attr('y', 50)
      .attr('width', 300)
      .attr('height', 300)
      .style('stroke', 'black')
      .style('fill', 'none');
    
    umapSvg.append('text')
      .attr('x', 200)
      .attr('y', 370)
      .attr('text-anchor', 'middle')
      .text('UMAP1');
    
    umapSvg.append('text')
      .attr('x', 70)
      .attr('y', 280)
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90,10,250)')
      .text('UMAP2');

    // Get unique group values
    const groups = Array.from(new Set(umapData.map(d => d.group)));

    // Add a legend group
    const legend = umapSvg.append('g')
    .attr('transform', 'translate(365,55)');  // adjust position as needed

    // Add rectangles for each color
    legend.selectAll('rect')
    .data(groups)
    .join('rect')
        .attr('x', 0)
        .attr('y', (d, i) => i * 20)  // creates a vertical legend
        .attr('width', 10)
        .attr('height', 10)
        .attr('fill', d => color(d));

    // Add text labels for each color
    legend.selectAll('text')
    .data(groups)
    .join('text')
        .attr('x', 15)  // offset from rectangle
        .attr('y', (d, i) => i * 20 + 9)  // aligns text with rectangles
        .text(d => d);

    // Draw points and setup interactivity
    const tooltip = d3.select('body').append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

    let selected = null;

    const points = umapSvg.selectAll('circle')
    .data(umapData)
    .join('circle')
        .attr('cx', d => umapX(+d.UMAP1))
        .attr('cy', d => umapY(+d.UMAP2))
        .attr('r', d => d === selected ? 10 : 5)
        .attr('fill', d => color(d.group))
        .attr('stroke', 'black')
        .attr('stroke-width', 0.9)
        .on('mouseover', function(event, d) {
            // Show tooltip
            tooltip.transition()
                .duration(200)
                .style('opacity', 1.0);
            tooltip.html(d.sample_name)
                .style('left', (event.pageX) + 'px')
                .style('top', (event.pageY - 28) + 'px');
            // Highlight this point
            d3.select(this)
              .transition()
              .duration(400)  // Adjust time in ms as needed
              .attr('r', 10);
        
            // Color tree nodes only if no point is selected
            if (selected === null) {
                treeSvg.selectAll('circle')
                    .attr('fill', node => {
                    const titer = titersData.find(t => t.sample_name === d.sample_name && t.virus_strain === node.data.name);
                    return titer ? nodeColor(+titer.ic50) : '#D3D3D3';
                });
            }
        })        
        .on('mouseout', function(event, d) {
            // Hide tooltip
            tooltip.transition()
                .duration(500)
                .style('opacity', 0);
            if (d !== selected) {
                // Un-highlight this point
                d3.select(this)
                  .transition()
                  .duration(400)  // Adjust time in ms as needed
                  .attr('r', 5.5);
                
                // Uncolor tree nodes only if no point is selected
                if (selected === null) {
                    treeSvg.selectAll('circle')
                    .attr('fill', '#D3D3D3');
                }
            }
        })            
    .on('click', function(event, d) {
      selected = selected === d ? null : d;
      points.attr('r', p => p === selected ? 10 : 5);
    });
  });  