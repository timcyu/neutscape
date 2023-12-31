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

// Get strain order for bar chart
function getStrainOrder(node) {
    let order = [];
    
    function traverse(n) {
        if (n.branchset) {
            n.branchset.forEach(traverse);
        }
        if (n.name) {
            order.push(n.name);
        }
    }
    traverse(node);
    return order;
}

// Load and process data
Promise.all([
    d3.csv('data/yang2022/umap.csv'),
    d3.text('data/yang2022/yang2022_tree.nwk'),
    d3.csv('data/yang2022/titers.csv'),
  ]).then(([umapData, treeData, titersData]) => {

    // Process tree data
    const root = parseNewick(treeData);
    let strainOrder = getStrainOrder(root);

    // Create a Map for quick lookup of strain index
    let strainIndex = new Map(strainOrder.map((strain, i) => [strain, i]));
        
    const tree = d3.cluster().size([340, 200])
      .separation((a, b) => 9)(d3.hierarchy(root, d => d.branchset));

    // Get an array of all titer values across all samples
    const allTiters = titersData.map(d => +d.log_hi_titer);

    // Compute the extent of all titer values
    const titerExtent = d3.extent(allTiters);
    
    // Define your color scale using the overall titer extent
    const nodeColor = d3.scaleSequential()
        .domain(titerExtent)
        .interpolator(d3.interpolatePurples);
  
    // Generate Phylogenetic tree
    const treeSvg = d3.select('#phylogram').append('svg')
        .attr('viewBox', [-100, -50, 550, 550])  // provide extra space for labels
        .attr('transform', 'translate(0, -500)');
  
    // Draw lines connecting nodes (adjusted to be straight)
    treeSvg.selectAll('path')
        .data(tree.links())
        .join('path')
          .attr('d', d => `M${d.source.y},${d.source.x} V${d.target.x} H${d.target.y}`)
          .attr('stroke', 'black')
          .attr('fill', 'none');
  
    // Draw nodes
    treeSvg.selectAll('circle')
    .data(tree.descendants().filter(d => !d.children)) // Only include leaf nodes
    .join('circle')
      .attr('transform', d => `translate(${d.y},${d.x})`)
      .attr('r', 5.5)
      .attr('fill', 'white')
      .attr('stroke', 'black')
      .attr('stroke-width', 0.9)
    .on('mouseover', function(event, node) {
        if (selected !== null) {
            // Show tooltip
            const titer = titersData.find(t => t.participant_id === selected.participant_id && t.strain === node.data.name);
            if (titer) {
                tooltip.transition()
                    .duration(200)
                    .style('opacity', 1.0);
                tooltip.html(`Participant ID: ${selected.participant_id}<br/>Strain: ${node.data.name}<br/>Log HI Titer: ${titer.log_hi_titer}`)
                    .style('left', (event.pageX + 20) + 'px')
                    .style('top', (event.pageY - 60) + 'px');
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
        .data(tree.descendants().filter(d => !d.children)) // Only include leaf nodes
        .join('text')
        .attr('transform', d => `translate(${d.y},${d.x})`)
        .attr('dy', '0.31em')
        .attr('dx', '10')  // offset label from node
        .text(d => d.data.name)
        .style('font-size', '13px');

    // Generate Density Map
    const densitySvg = d3.select('#densitymap').append('svg')
      .attr('viewBox', [0, 0, 500, 300])
      .attr('transform', 'translate(50, -100)');

    // Draw axes labels
    densitySvg.append('text')
      .attr('x', 200)
      .attr('y', 140)
      .attr('text-anchor', 'middle')
      .text('H3N2 antigenic evolution →');

    densitySvg.append('text')
      .attr('x', 175)
      .attr('y', 292)
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90,10,250)')
      .text('Titer');
    
    // Define x scale for density chart
    const densityX = d3.scaleBand()
      .range([60, 330])  // adjust to fit in bounding box
      .padding(0);  // adjust as needed

    // Define y scale for density chart
    const densityY = d3.scaleLinear()
      .domain([0, d3.max(allTiters)])
      .range([120, 50]);  // adjust and invert to fit in bounding box

    // Generate density curve
    const densityCurve = d3.area()
      .x(d => densityX(d.strain) + densityX.bandwidth() / 2)
      .y0(120)
      .y1(d => densityY(+d.log_hi_titer))
      .curve(d3.curveBasis);  // adjust the curve type for smoother curve

    // Draw bounding box for density chart
    densitySvg.append('rect')
      .attr('x', 60)
      .attr('y', 50)
      .attr('width', 270)
      .attr('height', 70)
      .style('stroke', 'black')
      .style('fill', 'none');

    // Update the density chart
    function updateDensityChart(participantId) {
      if (!participantId) {
        densitySvg.selectAll('path').remove(); // Remove the density curve if no participant is selected
        return;
      }

      const participantTiters = titersData.filter(t => t.participant_id === participantId);
      const titers = strainOrder.map(strain => {
        const titer = participantTiters.find(t => t.strain === strain);
        return {
          strain: strain,
          log_hi_titer: titer ? +titer.log_hi_titer : 0
        };
      });

      // Update the domain of the densityX scale to include only the strains that have data in titers
      const strainsWithData = titers.map(t => t.strain);
      densityX.domain(strainsWithData);

      // Select existing path and bind data
      const densityPath = densitySvg.selectAll('path')
        .data([titers]);

      // Remove any existing path
      densityPath.exit().remove();

      // Append new path
      densityPath.enter()
        .append('path')
        .merge(densityPath) // Merge new and existing path
        .attr('d', densityCurve)
        .attr('fill', '#8797de')
        .attr('stroke', 'black')
        .attr('stroke-width', 1)
        .attr('opacity', 1);
    }

    // Update the density chart initially
    updateDensityChart(null);

    // Generate UMAP
    const umapX = d3.scaleLinear()
      .domain(d3.extent(umapData, d => +d.UMAP1))
      .range([60, 330]);  // adjust to fit in bounding box
    
    const umapY = d3.scaleLinear()
      .domain(d3.extent(umapData, d => +d.UMAP2))
      .range([330, 70]);  // adjust and invert to fit in bounding box
    
    const umapSvg = d3.select('#umap').append('svg')
        .attr('viewBox', [0, 0, 450, 400])
        .attr('transform', 'translate(-250, -100)'); 
  
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
    const groups = Array.from(new Set(umapData.map(d => d.age_at_sampling)));

    // Sort the groups
    groups.sort();

    // Define the number of discrete colors you want
    let n = groups.length;

    // Set color scale
    const color = d3.scaleOrdinal()
      .domain(groups)
      .range(d3.schemeSpectral[n]);
        
    // Add a legend group
    const legend = umapSvg.append('g')
        .attr('transform', 'translate(365,55)');  // adjust position as needed

    // Add a title
    legend.append('text')
        .attr('x', 0)
        .attr('y', 5)  // position at the top of the legend
        .text('Age group')
        .style('font-size', '13px')
        .style('font-weight', 'bold');

    // Adjust the y positions of rectangles and text labels to make room for the title
    // Add rectangles for each color
    legend.selectAll('rect')
        .data(groups)
        .join('rect')
            .attr('x', 0)
            .attr('y', (d, i) => (i * 20) + 20)  // Add 20 to create room for the title
            .attr('width', 10)
            .attr('height', 10)
            .attr('font-size', '10px')
            .attr('fill', d => color(d));

    // Add text labels for each color
    legend.selectAll('text:not(:first-child)')  // select all text elements except the first one (the title)
        .data(groups)
        .join('text')
            .attr('x', 15)  // offset from rectangle
            .attr('y', (d, i) => (i * 20) + 29)  // Add 20 to create room for the title
            .text(d => d)
            .style('font-size', '13px');
    
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
      .attr('r', d => d === selected ? 10 : 3)
      .attr('fill', d => color(d.age_at_sampling))
      .attr('stroke', 'black')
      .attr('stroke-width', 0.5)
      .on('mouseover', function (event, d) {
        // Move point to front
        this.parentNode.appendChild(this);

        // Show tooltip
        tooltip.transition()
          .duration(200)
          .style('opacity', 1.0);
        tooltip.html(d.participant_id)
          .style('left', (event.pageX) + 'px')
          .style('top', (event.pageY - 50) + 'px');

        // Highlight this point
        d3.select(this)
          .transition()
          .duration(400)
          .attr('r', 10);

        // Color tree nodes only if no point is selected
        if (selected === null) {
          treeSvg.selectAll('circle')
            .attr('fill', node => {
              const titer = titersData.find(t => t.participant_id === d.participant_id && t.strain === node.data.name);
              return titer ? nodeColor(+titer.log_hi_titer) : 'white';
            });

          // Update the density chart
          updateDensityChart(d.participant_id);
        }

        // Show the bounding box for density chart
        densitySvg.select('rect')
          .style('stroke', 'black')
          .style('fill', 'none');
      })
      .on('mouseout', function (event, d) {
        // Hide tooltip
        tooltip.transition()
            .duration(500)
            .style('opacity', 0);
    
        if (d !== selected) {
            // Un-highlight this point
            d3.select(this)
                .transition()
                .duration(400)
                .attr('r', 3);
    
            // Uncolor tree nodes only if no point is selected
            if (selected === null) {
                treeSvg.selectAll('circle')
                    .attr('fill', 'white');
    
                // Remove the density chart if no point is moused over
                densitySvg.selectAll('path').remove();
            }
        }
    
        // Hide the tooltip
        tooltip.transition()
            .duration(200)
            .style('opacity', 0);
    
        // Restore the density chart bounding box stroke color
        densitySvg.select('rect')
            .style('stroke', 'black')
            .style('fill', 'none');
      })    
      .on('click', function(event, d) {
        // If no point is selected, or the currently selected point is clicked again
        if (selected === null || selected === d) {
          selected = selected === d ? null : d;
          points.attr('r', p => p === selected ? 10 : 3);
      
          // Update the density plot
          if (selected) {
            updateDensityChart(selected.participant_id);
          } else {
            // Show the density plot with default data (empty)
            updateDensityChart(null);
          }
        }
      });
  });  

// Get the instruction and exit buttons
const instructionButton = document.querySelector('#instruction-btn');
const exitButton = document.querySelector('#exit-button');

// Get the instruction box
const instructionBox = document.querySelector('#instruction-box');

// Add an event listener for the instruction button
instructionButton.addEventListener('click', () => {
    if(getComputedStyle(instructionBox).opacity == '0'){
        // Fade in the instruction box
        instructionBox.style.display = 'block'; // Make the box visible
        setTimeout(function(){ 
            instructionBox.style.opacity = '1'; // Then start the fade in
        }, 50); // This delay ensures display is set before we start the transition
    }
    else {
        // Fade out the instruction box
        instructionBox.style.opacity = '0';
        setTimeout(function(){ 
            instructionBox.style.display = 'none'; // Then hide the box
        }, 500); // This delay ensures the fade out completes before we hide the box
    }
});

// Add an event listener for the exit button
exitButton.addEventListener('click', () => {
    // Fade out the instruction box
    instructionBox.style.opacity = '0';
    setTimeout(function(){ 
        instructionBox.style.display = 'none'; // Then hide the box
    }, 500); // This delay ensures the fade out completes before we hide the box
});
