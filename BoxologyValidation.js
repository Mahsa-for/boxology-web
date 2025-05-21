// Boxology Plugin with correct pattern instance handling
Draw.loadPlugin(function(ui) {
    console.log("✅ Boxology Plugin Loaded");

    var graph = ui.editor.graph;
    graph.setDisconnectOnMove(false);
    graph.setCellsDisconnectable(false);
    graph.setCellsDeletable(true);
    graph.setAllowDanglingEdges(false);
    graph.setTooltips(true);

    graph.getTooltipForCell = function(cell) {
        return cell.tooltip || null;
    };
//List of all pattern
    const allPatterns = [
        { name: "train_model (symbol)", edges: [["symbol", "generate:train"], ["generate:train", "model"]] },
        { name: "train_model (data)", edges: [["data", "generate:train"], ["generate:train", "model"]] },
        { name: "transform symbol", edges: [["symbol", "transform"], ["transform", "data"]] },
        { name: "transform symbol/data", edges: [["symbol/data", "transform"], ["transform", "data"]] },
        { name: "transform data", edges: [["data", "transform"], ["transform", "data"]] },
        { name: "generate_model from actor", edges: [["actor", "generate:engineer"], ["generate:engineer", "model"]] },
        { name: "infer_symbol (symbol → model → symbol)", edges: [["model", "infer:deduce"], ["symbol", "infer:deduce"], ["infer:deduce", "symbol"]] },
        { name: "infer_symbol (symbol/data → model → symbol)", edges: [["model", "infer:deduce"], ["symbol/data", "infer:deduce"], ["infer:deduce", "symbol"]] },
        { name: "infer_symbol (data → model → symbol)", edges: [["model", "infer:deduce"], ["data", "infer:deduce"], ["infer:deduce", "symbol"]] },
        { name: "infer_model (symbol → model → model)", edges: [["model", "infer:deduce"], ["symbol", "infer:deduce"], ["infer:deduce", "model"]] },
        { name: "infer_model (symbol/data → model → model)", edges: [["model", "infer:deduce"], ["symbol/data", "infer:deduce"], ["infer:deduce", "model"]] },
        { name: "infer_model (data → model → model)", edges: [["model", "infer:deduce"], ["data", "infer:deduce"], ["infer:deduce", "model"]] },
        { name: "embed transform", edges: [["symbol", "transform:embed"], ["data", "transform:embed"], ["data", "model:semantic"]] }
    ];

//To limit user for connecting nodes, which logicaly can not be next step in flow
    const validNext = {
        "symbol": ["infer:deduce", "generate:train", "transform:embed", "transform", "symbol"],
        "data": ["infer:deduce", "generate:train", "transform", "data"],
        "symbol/data": ["infer:deduce", "transform:embed", "transform", "symbol/data"],
        "infer:deduce": ["symbol", "model", "infer:deduce"],
        "model": ["infer:deduce", "model", "model:statistics", "model:semantic"],
        "generate:train": ["model", "generate:train", "model:semantic", "model:statistics"],
        "actor": ["generate:engineer", "actor"],
        "generate:engineer": ["model", "generate:engineer"],
        "model:semantic": ["infer:deduce", "transform:embed", "model:semantic", "model"],
        "model:statistics": ["infer:deduce", "transform:embed", "model:statistics", "model"],
        "transform:embed": ["data", "transform:embed"],
        "transform": ["data", "symbol", "symbol/data", "transform"]
    };

//The function which check validation for each pattern seperatedly and support complex pattern
    function validatePattern() {
        const selectedCells = graph.getSelectionCells();
        if (selectedCells.length === 0) {
            alert("⚠️ No selection made! Please select a pattern before validation.");
            return;
        }

		const model = graph.getModel();
		const ignoredNames = ["text", "conditions"];
		const ignoredStyles = ["swimlane"]; // Add swimlane style to the ignored list

		const nodes = selectedCells.filter(cell => 
		  !cell.edge && 
		  !ignoredNames.includes(cell.name) && 
		  !ignoredStyles.includes(cell.style)
		);


        const edges = selectedCells.filter(cell => cell.edge);

        const edgeList = edges.map(edge => [edge.source.id, edge.target.id]);
        const edgeNameList = edges.map(edge => [edge.source.name, edge.target.name]);

        const matchedPatterns = [];
        const matchedNodeIds = new Set();
        const usedEdgeIndices = new Set();

        allPatterns.forEach(pattern => {
            const required = [...pattern.edges];
            const tempEdges = [...edgeNameList];

            while (true) {
                let matched = [];
                let involvedNodeIds = new Set();

                for (let [from, to] of required) {
				let index = tempEdges.findIndex(([s, t], i) => s === from && t === to && !usedEdgeIndices.has(i));
				if (index === -1) return;

                    matched.push(index);
                    involvedNodeIds.add(edges[index].source.id);
                    involvedNodeIds.add(edges[index].target.id);
                }

                // store matched pattern
                matchedPatterns.push({ name: pattern.name, edges: required });
                matched.forEach(i => usedEdgeIndices.add(i));
                matched.forEach(i => tempEdges[i] = ["", ""]);
                involvedNodeIds.forEach(id => matchedNodeIds.add(id));

                // check if more of this pattern exist
                if (!required.every(([from, to]) => tempEdges.some(([s, t]) => s === from && t === to))) break;
            }
        });

        nodes.forEach(n => delete n.tooltip);

        const unmatched = nodes.filter(n => !matchedNodeIds.has(n.id));
		
        const isolatedNodes = nodes.filter(n => model.getEdges(n).length === 0);

        const duplicateInputs = new Set();
        const duplicateOutputs = new Set();

        nodes.forEach(node => {
            const incoming = model.getEdges(node, true, false) || [];
            const outgoing = model.getEdges(node, false, true) || [];

            const inputNames = {};
            incoming.forEach(e => {
                const name = e.source.name;
                inputNames[name] = (inputNames[name] || 0) + 1;
            });
            if (Object.values(inputNames).some(c => c > 1)) {
                duplicateInputs.add(node.id);
                node.tooltip = "❌ Duplicate input types detected.";
            }

            const outputNames = {};
            outgoing.forEach(e => {
                const name = e.target.name;
                outputNames[name] = (outputNames[name] || 0) + 1;
            });
            if (Object.values(outputNames).some(c => c > 1)) {
                duplicateOutputs.add(node.id);
                node.tooltip = "❌ Duplicate output types detected.";
            }

            if (incoming.length + outgoing.length === 0) {
                node.tooltip = "⚠️ Node is disconnected.";
            } else if (!matchedNodeIds.has(node.id)) {
                node.tooltip = "⚠️ Node not part of any valid pattern.";
            }
        });

        if (unmatched.length === 0 && isolatedNodes.length === 0 && duplicateInputs.size === 0 && duplicateOutputs.size === 0 && matchedPatterns.length > 0) {
            const summary = matchedPatterns.map(p => "• " + p.name).join("\n");
            alert("✅ Valid full pattern(s):\n" + summary);
        } else {
            alert("❌ Invalid pattern: Issues detected.");
        }
    }

//If two node has same name and user connect them toghether, consider as one node.
    function mergeIdenticalNodes(edge) {
        let source = edge.source;
        let target = edge.target;
        if (!source || !target || source === target) return;
        if (source.value === target.value) {
            let model = graph.getModel();
            let inEdges = model.getEdges(target, true, false);
            let outEdges = model.getEdges(target, false, true);
            model.beginUpdate();
            try {
                inEdges.forEach(e => { if (e !== edge) e.target = source; });
                outEdges.forEach(e => { if (e !== edge) e.source = source; });
                model.remove(edge);
                model.remove(target);
            } finally {
                model.endUpdate();
            }
        }
    }
//Check to avoid wrong connections
    graph.addListener(mxEvent.CELL_CONNECTED, function(sender, evt) {
        let edge = evt.getProperty("edge");
        if (!edge || !edge.source || !edge.target) return;

        let source = edge.source.name;
        let target = edge.target.name;

        if (!validNext[source] || !validNext[source].includes(target)) {
            alert("❌ Invalid connection! Edge will be removed.");
            graph.getModel().remove(edge);
            return;
        }

        const incoming = graph.getModel().getEdges(edge.target, true, false);
        const inputCounts = {};
        incoming.forEach(e => {
            if (e.source && e.source.name) {
                const name = e.source.name;
                inputCounts[name] = (inputCounts[name] || 0) + 1;
            }
        });
        if (Object.values(inputCounts).some(count => count > 1)) {
            alert(`❌ Duplicate input detected to '${target}' from same type.`);
            graph.getModel().remove(edge);
            return;
        }

        const outgoing = graph.getModel().getEdges(edge.source, false, true);
        const outputCounts = {};
        outgoing.forEach(e => {
            if (e.target && e.target.name) {
                const name = e.target.name;
                outputCounts[name] = (outputCounts[name] || 0) + 1;
            }
        });
        if (Object.values(outputCounts).some(count => count > 1)) {
            alert(`❌ Duplicate output detected from '${source}' to same type.`);
            graph.getModel().remove(edge);
            return;
        }

        if (edge.source.name === edge.target.name) {
            mergeIdenticalNodes(edge);
        }
    });

    function addValidationButton() {
        const toolbar = ui.toolbar.container;
        const button = document.createElement("button");
        button.textContent = "Validate Pattern";
        button.style.marginLeft = "10px";
        button.style.padding = "5px 10px";
        button.style.border = "1px solid #000";
        button.style.background = "#4CAF50";
        button.style.color = "white";
        button.style.cursor = "pointer";
        button.style.fontWeight = "bold";
        button.onclick = validatePattern;
        toolbar.appendChild(button);
    }

    graph.removeCells = function(cells, includeEdges) {
        let model = this.getModel();
        model.beginUpdate();
        try {
            cells.forEach(cell => {
                if (!cell.edge) {
                    let connectedEdges = model.getEdges(cell, true, true);
                    connectedEdges.forEach(edge => model.remove(edge));
                    console.log(`🗑️ Deleted node "${cell.name}" with its edges`);
                }
            });
            mxGraph.prototype.removeCells.call(this, cells, includeEdges);
        } finally {
            model.endUpdate();
        }
    };

    addValidationButton();
    console.log("✅ Full Boxology Plugin Loaded.");
});
