/*
Copyright 2017 Benjamin RICAUD

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Interface between the visualization and the Gremlin server.

var traversal_source = getUrlParameter('ts');
if (traversal_source == null) {
    traversal_source = "g"
}

var graphioGremlin = (function(){
	"use strict";

	var _node_properties = [];
	var _edge_properties = [];


	function get_node_properties(){
		return _node_properties;
	}
	function get_edge_properties(){
		return _edge_properties;
	}

		function create_single_command(query){
			var equalIndex = query.indexOf("=");
			var semiColonIndex = query.indexOf(";");
			if( equalIndex >= 0){
				if(semiColonIndex < 0){
					query = query.substring(equalIndex+1);
				} else {
					query = query.substring(equalIndex+1,semiColonIndex);
				}
			}
			var returnQuery = query.trim();
			return returnQuery;
		}

	function get_graph_info(){
		var gremlin_query_nodes = "nodes = " + traversal_source + ".V().limit(" + graphDefinedBy + ").groupCount().by(label);"
		var gremlin_query_edges = "edges = " + traversal_source + ".E().limit(" + graphDefinedBy + ").groupCount().by(label);"
		var gremlin_query_nodes_prop = "nodesprop = " + traversal_source + ".V().limit(" + graphDefinedBy + ").valueMap().select(keys).groupCount();"
		var gremlin_query_edges_prop = "edgesprop = " + traversal_source + ".E().limit(" + graphDefinedBy + ").valueMap().select(keys).groupCount();"

		var gremlin_query = gremlin_query_nodes+gremlin_query_nodes_prop
			+gremlin_query_edges+gremlin_query_edges_prop
			+ "[nodes.toList(),nodesprop.toList(),edges.toList(),edgesprop.toList()]"
		// while busy, show we're doing something in the messageArea.
		$('#messageArea').html('<h3>(loading)</h3>');
		var message = ""
				if(SINGLE_COMMANDS_AND_NO_VARS){
					var node_label_query = create_single_command(gremlin_query_nodes);
					var edge_label_query = create_single_command(gremlin_query_edges);
					var node_prop_query = create_single_command(gremlin_query_nodes_prop);
					var edge_prop_query = create_single_command(gremlin_query_edges_prop);
					send_to_server(node_label_query, null, null, null, function(nodeLabels){
					   send_to_server(edge_label_query, null, null, null, function(edgeLabels){
						   send_to_server(node_prop_query, null, null, null, function(nodeProps){
							   send_to_server(edge_prop_query, null, null, null, function(edgeProps){
								   var combinedData = [nodeLabels, nodeProps, edgeLabels, edgeProps];
								   console.log("Combined data", combinedData);
								   handle_server_answer(combinedData,'graphInfo',null,message);
							   });
						   });
					   });
					});
				} else {
					send_to_server(gremlin_query,'graphInfo',null,message)
				}
	}

	/**
	 * Gets the limit of all queries. 
	 * This is to make sure we don't explode out/inwards
	 */
	function getLimitedGremlinQuery(){
		let limit_field = $('#limit_field').val();
		if (limit_field !== "" && isInt(limit_field) && limit_field > 0) {
			return ".limit(" + limit_field + ")";
		} else {
			return ".limit(" + node_limit_per_request + ")";
		}
	}

	function search_query() {
		// Preprocess query
		let input_string = $('#search_value').val();
		let input_field = $('#search_field').val();
		let label_field = $('#label_field').val();
		let search_type = $('#search_type').val();
		
		var filtered_string = input_string;//You may add .replace(/\W+/g, ''); to refuse any character not in the alphabet
		if (filtered_string.length>50) filtered_string = filtered_string.substring(0,50); // limit string length
		
		// Translate to Gremlin query
		let has_str = "";
		if (label_field !== "") {
			has_str = ".hasLabel('" + label_field + "')";
		}
		
		if (input_field !== "" && input_string !== "") {
			has_str += ".has('" + input_field + "',";
			switch (search_type) {
				case "eq":
					if (isInt(input_string)){
						has_str += filtered_string + ")"
					} else {
						has_str += "'" + filtered_string + "')"
					}
					break;
				case "contains":
					has_str += "textContains('" + filtered_string + "'))";
					break;
			}
		} 

		let gremlin_query_nodes = "nodes = " + traversal_source + ".V()" + has_str + getLimitedGremlinQuery() + ".toList();";
		let gremlin_query_edges = "edges = " + traversal_source + ".V(nodes).aggregate('node').outE().as('edge').inV().where(within('node')).select('edge').toList();";
    let gremlin_query_edges_no_vars = "edges = " + traversal_source + ".V()"+has_str+".aggregate('node').outE().as('edge').inV().where(within('node')).select('edge').toList();";
		let gremlin_query = gremlin_query_nodes + gremlin_query_edges + "[nodes,edges]";
		console.log(gremlin_query);

		// while busy, show we're doing something in the messageArea.
		$('#messageArea').html('<h3>(loading)</h3>');

		// To display the queries in the message area:
		//var message_nodes = "<p>Node query: '"+gremlin_query_nodes+"'</p>";
		//var message_edges = "<p>Edge query: '"+gremlin_query_edges+"'</p>";
		//var message = message_nodes + message_edges;
		
		var message = "";
		if (SINGLE_COMMANDS_AND_NO_VARS) {
			var nodeQuery = create_single_command(gremlin_query_nodes);
			var edgeQuery = create_single_command(gremlin_query_edges_no_vars);
			console.log("Node query: "+nodeQuery);
			console.log("Edge query: "+edgeQuery);
			send_to_server(nodeQuery, null, null, null, function(nodeData){
				send_to_server(edgeQuery, null, null, null, function(edgeData){
					var combinedData = [nodeData,edgeData];
					handle_server_answer(combinedData, 'search', null, message);
				});
			});
		} else {
			send_to_server(gremlin_query,'search',null,message);
		}
	}

	function isInt(value) {
	  return !isNaN(value) &&
			 parseInt(Number(value)) == value &&
			 !isNaN(parseInt(value, 10));
	}

	function getTraversableEdges(){
		var edgesToTraverse = "";
		var isLastMileChecked = $('#last-mile')[0].checked;
		var isLineHaulChecked = $('#line-haul')[0].checked;

		if(isLastMileChecked && isLineHaulChecked){
			edgesToTraverse = "'LineHaul','LastMile'"
		} else if(isLastMileChecked){
			edgesToTraverse = "'LastMile'"
		} else if(isLineHaulChecked){
			edgesToTraverse = "'LineHaul'"
		} else {
			edgesToTraverse = "'NoEdgesToTravese'" //Hack to make sure no edges returned when both check boxes are unticked
		}
		
		return edgesToTraverse
	}

	function click_query(d) {
		var id = d.id;
		if(isNaN(id)){ // Add quotes if id is a string (not a number).
			id = '"'+id+'"';
		}
		
		var raw_query = traversal_source + ".V(" + id + ").as('v1').bothE(" + getTraversableEdges() + ").as('e').bothV().as('v2').where(neq('v1'))" + getLimitedGremlinQuery() + ".path()"
		var gremlin_query_nodes = "nodes = " + raw_query + ".select('v1', 'v2').select(values).unfold()"
		var gremlin_query_edges = "edges = " + raw_query + ".select('e')"
		var gremlin_query = gremlin_query_nodes+'\n'+gremlin_query_edges+'\n'+'[nodes.toList(),edges.toList()]'
		console.log(gremlin_query);
		
		// while busy, show we're doing something in the messageArea.
		$('#messageArea').html('<h3>(loading)</h3>');
		
		var message = "<p>Query ID: "+ d.id +"</p>"
		send_to_server(gremlin_query,'click',d.id,message);
}

	function send_to_server(gremlin_query,query_type,active_node,message, callback){
		let COMMUNICATION_PROTOCOL = 'REST'
			if (COMMUNICATION_PROTOCOL == 'REST'){
				let server_url = "http://"+host+":"+port;
				run_ajax_request(gremlin_query,server_url,query_type,active_node,message,callback);
			} else {
				console.log('Bad communication protocol. Check configuration file. Accept "REST" or "websocket" .')
			}
				
	}

	/////////////////////////////////////////////////////////////////////////////////////////////////
	// AJAX request for the REST API
	////////////////////////////////////////////////////////////////////////////////////////////////
	function run_ajax_request(gremlin_query,server_url,query_type,active_node,message, callback){
		// while busy, show we're doing something in the messageArea.
		$('#messageArea').html('<h3>(loading)</h3>');

		// Get the data from the server
		$.ajax({
			type: "POST",
			accept: "application/json",
			//contentType:"application/json; charset=utf-8",
			url: server_url,
			//headers: GRAPH_DATABASE_AUTH,
			timeout: REST_TIMEOUT,
			data: JSON.stringify({"gremlin" : gremlin_query}),
			success: function(data, textStatus, jqXHR){
							var Data = data.result.data;
							//console.log(Data)
							//console.log("Results received")
							if(callback){
								callback(Data);
							} else {				
								handle_server_answer(Data,query_type,active_node,message);
							}
			},
			error: function(result, status, error){
				console.log("Connection failed. "+status);

				// This will hold all error messages, to be printed in the
				// output area.
				let msgs = [];

				if (query_type == 'editGraph'){
					msgs.push('Problem accessing the database using REST at ' + server_url);
					msgs.push('Message: ' + status + ', ' + error);
					msgs.push('Possible cause: creating an edge with bad node ids ' +
						'(linking nodes not existing in the DB).');
				} else {
					msgs.push('Can\'t access database using REST at ' + server_url);
					msgs.push('Message: ' + status + ', ' + error);
					msgs.push('Check the server configuration ' +
						'or try increasing the REST_TIMEOUT value in the config file.');
				}

				// If a MalformedQueryException is received, user might be
				// trying to reach an Amazon Neptune DB. Point them to the
				// config file as a probable cause.
				if (result.status === 400
					&& SINGLE_COMMANDS_AND_NO_VARS === false
					&& result.hasOwnProperty('responseJSON')
					&& result.responseJSON.code === 'MalformedQueryException') {
					msgs.push('If connecting to an Amazon Neptune databse, ensure that ' +
						'SINGLE_COMMANDS_AND_NO_VARS is set to true in the config file.');
				}

				$('#outputArea').html(msgs.map(function (i) {return '<p>' + i + '</p>'}).join(''));
				$('#messageArea').html('');
			}
		});
	}

	//////////////////////////////////////////////////////////////////////////////////////////////////
	function handle_server_answer(data,query_type,active_node,message){
		let COMMUNICATION_METHOD = "GraphSON3"
		if (query_type == 'editGraph'){
			//console.log(data)
			$('#outputArea').html("<p> Data successfully written to the DB.</p>");
			$('#messageArea').html('');
			return // TODO handle answer to check if data has been written
		}
		//console.log(COMMUNICATION_METHOD)
		if (COMMUNICATION_METHOD == 'GraphSON3'){
			//console.log(data)
			data = graphson3to1(data);
			var arrange_data = arrange_datav3;
		} else {
			console.log('Bad communication protocol. Accept "GraphSON2" or "GraphSON3".'
				+' Using default GraphSON3.')
			data = graphson3to1(data);
			var arrange_data = arrange_datav3;
		}
		if (!(0 in data)) {
			message = 'No data. Check the communication protocol. (Try changing Gremlin version to 3.3.*).'
			console.log(message)
			$('#outputArea').html(message);
			$('#messageArea').html('');

		}
		if (query_type=='graphInfo'){
			infobox.display_graph_info(data);
			_node_properties = make_properties_list(data[1][0]);
			_edge_properties = make_properties_list(data[3][0]);
			change_nav_bar(_node_properties,_edge_properties);
			display_properties_bar(_node_properties,'nodes','Node properties:');
			display_properties_bar(_edge_properties,'edges','Edge properties:');
			display_color_choice(_node_properties,'nodes','Node color by:');
		} else {
			//console.log(data);
			var graph = arrange_data(data);
			//console.log(graph)
			if (query_type=='click') var center_f = 0; //center_f=0 mean no attraction to the center for the nodes 
			else if (query_type=='search') var center_f = 1;
			else return;
			graph_viz.refresh_data(graph,center_f,active_node);
		}

		$('#outputArea').html(message);
		$('#messageArea').html('');
	}



	//////////////////////////////////////////////////////////////////////////////////////////////////
	function make_properties_list(data){
		var prop_dic = {};
		for (var prop_str in data){
			prop_str = prop_str.replace(/[\[\ \"\'\]]/g,''); // get rid of symbols [,",',] and spaces
			var prop_list = prop_str.split(',');
			//prop_list = prop_list.map(function (e){e=e.slice(1); return e;});
			for (var prop_idx in prop_list){
				prop_dic[prop_list[prop_idx]] = 0;
			}
		}
		var properties_list = [];
		for (var key in prop_dic){
			properties_list.push(key);
		}
		return properties_list;
	}

	///////////////////////////////////////////////////
	function idIndex(list,elem) {
	  // find the element in list with id equal to elem
	  // return its index or null if there is no
	  for (var i=0;i<list.length;i++) {
		if (list[i].id == elem) return i;
	  }
	  return null;
	}  

	function arrange_datav3(data) {
		// Extract node and edges from the data returned for 'search' and 'click' request
		// Create the graph object
		var nodes=[], links=[];
		if(data!=null) {
			for (var key in data){

				var innerElement = data[key]
				if(innerElement!=null) {
					//Filtering out labels used in query
					if(typeof(innerElement.objects) !== 'undefined'){
						innerElement = innerElement.objects
					}

					//Adding each element to the visualiser
					innerElement.forEach(function (item) {
						if (!("inV" in item) && idIndex(nodes,item.id) == null){ // if vertex and not already in the list
							item.type = "vertex";
							nodes.push(extract_infov3(item));
						}
						if (("inV" in item) && idIndex(links,item.id) == null){
							item.type = "edge";
							links.push(extract_infov3(item));
						}
					});
				}
			}
		}
	  return {nodes:nodes, links:links};
	}


	function extract_infov2(data) {
		var data_dic = {id:data.id, label:data.label, type:data.type, properties:{}}
		var prop_dic = data.properties
		for (var key in prop_dic) {
			if (prop_dic.hasOwnProperty(key)) {
				data_dic.properties[key] = prop_dic[key]
			}
		}
		if (data.type=="edge"){
			data_dic.source = data.outV
			data_dic.target = data.inV
		}
		return data_dic
	}

	function extract_infov3(data) {
	var data_dic = {id:data.id, label:data.label, type:data.type, properties:{}}
	var prop_dic = data.properties
	//console.log(prop_dic)
	for (var key in prop_dic) { 
		if (prop_dic.hasOwnProperty(key)) {
			if (data.type == 'vertex'){// Extracting the Vertexproperties (properties of properties for vertices)
				var property = prop_dic[key];
				property['summary'] = get_vertex_prop_in_list(prop_dic[key]).toString();
			} else {
				var property = prop_dic[key]['value'];
			}
			//property = property.toString();
			data_dic.properties[key] = property;
			// If  a node position is defined in the DB, the node will be positioned accordingly
			// a value in fx and/or fy tells D3js to fix the position at this value in the layout
			if (key == node_position_x) {
				data_dic.fx = prop_dic[node_position_x]['0']['value'];
			}
			if (key == node_position_y) {
				data_dic.fy = prop_dic[node_position_y]['0']['value'];
			}
		}
	}
	if (data.type=="edge"){
		data_dic.source = data.outV;
		data_dic.target = data.inV;
		if (data.id !== null && typeof data.id === 'object'){
			console.log('Warning the edge id is an object')
			if ("relationId" in data.id){
				data_dic.id = data.id.relationId;
			}
		}
	}
	return data_dic
}

function get_vertex_prop_in_list(vertexProperty){
	var prop_value_list = [];
	for (var key in vertexProperty){
		//console.log(vertexprop);
		prop_value_list.push(vertexProperty[key]['value']);
	}
	return prop_value_list;
}

	function graphson3to1(data){
		// Convert data from graphSON v2 format to graphSON v1
		if (!(Array.isArray(data) || ((typeof data === "object") && (data !== null)) )) return data;
		if ('@type' in data) {
			if (data['@type']=='g:List'){
				data = data['@value'];
				return graphson3to1(data);
			} else if (data['@type']=='g:Set'){
				data = data['@value'];
				return data;
			} else if(data['@type']=='g:Map'){
				var data_tmp = {}
				for (var i=0;i<data['@value'].length;i+=2){
					var data_key = data['@value'][i];
					if( (typeof data_key === "object") && (data_key !== null) ) data_key = graphson3to1(data_key);
					//console.log(data_key);
					if (Array.isArray(data_key)) data_key = JSON.stringify(data_key).replace(/\"/g,' ');//.toString();
					data_tmp[data_key] = graphson3to1(data['@value'][i+1]);
				}
				data = data_tmp;
				return data;
			} else {
				data = data['@value'];
				if ( (typeof data === "object") && (data !== null) ) data = graphson3to1(data);
				return data;
			}
		} else if (Array.isArray(data) || ((typeof data === "object") && (data !== null)) ){
			for (var key in data){
				data[key] = graphson3to1(data[key]);
			}
			return data;
		}
		return data;
	}

	return {
		get_node_properties : get_node_properties,
		get_edge_properties : get_edge_properties,
		get_graph_info : get_graph_info,
		search_query : search_query,
		click_query : click_query,
		send_to_server : send_to_server
	}
})();
