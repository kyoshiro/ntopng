/**
    (C) 2022 - ntop.org
*/
import { ntopng_utility, ntopng_url_manager } from "../services/context/ntopng_globals_services.js";
import NtopUtils from "./ntop-utils.js";

const set_timeseries_groups_in_url = (timeseries_groups) => {
    let params_timeseries_groups = [];
    timeseries_groups.forEach((ts_group) => {
	let param = get_ts_group_url_param(ts_group);
	params_timeseries_groups.push(param);
    });
    let url_timeseries_groups = params_timeseries_groups.join(";");
    ntopng_url_manager.set_key_to_url("timeseries_groups", url_timeseries_groups);
};

function get_ts_group_url_param(ts_group) {
    let timeseries = [];
    ts_group.timeseries.forEach((ts) => {
	timeseries.push(`${ts.id}=${ts.raw}:${ts.past}:${ts.avg}:${ts.perc_95}`);
    });
    let metric_schema_query = ts_group.metric.schema;
    if (ts_group.metric.query != null) {
	metric_schema_query = `${metric_schema_query}+${ts_group.metric.query}`;
    }
    let timeseries_param = timeseries.join("|");
    let param = `${ts_group.source_type.value},${ts_group.source.value},${metric_schema_query},${timeseries_param}`;
    return param;
}

const get_timeseries_groups_from_url = async (http_prefix, url_timeseries_groups) => {
    if (url_timeseries_groups == null) {
	url_timeseries_groups = ntopng_url_manager.get_url_entry("timeseries_groups");
    }
    if (url_timeseries_groups == null || url_timeseries_groups == "") {
	return null;
    }
    let groups = url_timeseries_groups.split(";");
    if (!groups?.length > 0) {
	return null;
    }
    let metrics = await get_metrics(http_prefix);
    let timeseries_groups = Promise.all(groups.map(async (g) => {
	let ts_group = await get_url_param_from_ts_group(g);
	return ts_group;
    }));
    return timeseries_groups;
};

const get_ts_group = (source_type, source, metric) => {
    let id = get_ts_group_id(source_type, source, metric);
    let timeseries = [];
    for (let key in metric.timeseries) {
	let ts = metric.timeseries[key];
	timeseries.push({
	    id: key,
	    label: ts.label,
	    raw: true,
	    past: false,
	    avg: false,
	    perc_95: false,
	});
    }
    return {
	id, source_type, source, metric, timeseries,
    };
};

const get_default_timeseries_groups = async (http_prefix) => {
    let source_type = get_current_page_source_type();
    let source = await get_default_source(http_prefix, source_type);
    let metrics = await get_metrics(http_prefix, source_type, source.value);
    let metric = get_default_metric(metrics);
    let ts_group = get_ts_group(source_type, source, metric);
    return [ts_group];
};

async function get_url_param_from_ts_group(ts_group_url_param) {
    let g = ts_group_url_param;
    let info = g.split(",");
    let source_type_value = info[0];
    let source_value = info[1];
    let metric_schema_query = info[2];
    let metric_schema_query_array = metric_schema_query.split("+");
    if (metric_schema_query_array.lenght < 2) {
	metric_schema_query_array.push(null);
    }
    let timeseries_url = info[3];

    let source_type = get_source_type_from_value(source_type_value);
    let source = await get_source_from_value(http_prefix, source_type, source_value);
    let metric = await get_metrics_from_schema(http_prefix, source_type, source_value, metric_schema_query_array[0], metric_schema_query_array[1]);
    let timeseries = get_timeseries(timeseries_url, metric);
    return {
	id: get_ts_group_id(source_type, source, metric),
	source_type,
	source,
	metric,
	timeseries,
    };
}

const get_ts_group_id = (source_type, source, metric) => {
    let metric_id = metric.schema;
    if (metric.query != null) {
	metric_id = `${metric_id} - ${metric.query}`;
    }
    return `${source_type.value} - ${source.value} - ${metric_id}`;
};

function get_timeseries(timeseries_url, metric) {
    let ts_url_array = timeseries_url.split("|");
    let r = /(.+)=(.+):(.+):(.+):(.+)/;
    let timeseries = [];
    ts_url_array.forEach((ts_url) => {
	let values = r.exec(ts_url);
	let id = values[1];
	let label = metric.timeseries[id].label;
	let raw = JSON.parse(values[2]);
	let past = JSON.parse(values[3]);
	let avg = JSON.parse(values[4]);
	let perc_95 = JSON.parse(values[5]);
	timeseries.push({
	    id, label, raw, past, avg, perc_95,
	});
    });
    return timeseries;
}

const sources_types = [
    {
	label: "Interface",
	sources_url: "lua/rest/v2/get/ntopng/interfaces.lua",
	value: "ifid",
    },
];

const get_source_type_from_value = (source_type_value) => {
    return sources_types.find((st) => st.value == source_type_value);
};

const get_default_source = async (http_prefix, source_type) => {
    let source_value = get_default_source_value(source_type);
    let source = await get_source_from_value(http_prefix, source_type, source_value);
    return source;
};

const get_source_from_value = async (http_prefix, source_type, source_value) => {
    if (source_type == null) {
	source_type = get_current_page_source_type();
    }
    let sources = await get_sources(http_prefix, source_type);
    return sources.find((s) => s.value == source_value);
};

let cache_sources = {};
const get_sources = async (http_prefix, source_type) => {
    if (source_type == null) {
	source_type = get_current_page_source_type();
    }
    let url = `${http_prefix}/${source_type.sources_url}`;
    let key = source_type.value;
    if (cache_sources[key] == null) {
	cache_sources[key] = ntopng_utility.http_request(url);
    }
    let res = await cache_sources[key];
    if (source_type.value == "ifid") {
	const sources = res.map((s) => {
	    let label = s.ifname;
	    if (s.name != null) {
		label = s.name;
	    }
        return {
          label,
          value: s.ifid,
        };
	    });
      return sources.sort(NtopUtils.sortAlphabetically)
    }
    throw "source_type not reconized";
};

const get_default_source_value = (source_type) => {
    if (source_type == null) {
	source_type = get_current_page_source_type();
    }
    return ntopng_url_manager.get_url_entry(source_type.value);
};

let cache_metrics = {};
let last_metrics_time_interval = null;
const get_metrics = async (http_prefix, source_type, source_value) => {
    let epoch_begin = ntopng_url_manager.get_url_entry("epoch_begin");
    let epoch_end = ntopng_url_manager.get_url_entry("epoch_end");
    let current_last_metrics_time_interval = `${epoch_begin}_${epoch_end}`;
    if (source_type == null) {
	source_type = get_current_page_source_type();
    }
    if (source_value == null) {
	source_value = get_default_source_value(source_type);
    }
    let url = `${http_prefix}/lua/pro/rest/v2/get/timeseries/type/consts.lua?query=${source_type.value}`;
    let key = `${source_type.value}_${source_value}`;
    if (current_last_metrics_time_interval != last_metrics_time_interval) {
	cache_metrics[key] = null;
	last_metrics_time_interval = current_last_metrics_time_interval;
    }
    if (cache_metrics[key] == null) {
	cache_metrics[key] = ntopng_utility.http_request(url);
    }
    let metrics = await cache_metrics[key];
    return ntopng_utility.clone(metrics);
};

const get_current_page_source_type = () => {
    let pathname = window.location.pathname;
    if (/if_stats/.test(pathname) == true) {
	return sources_types[0];
    } 
    throw `source_type not found for ${pathname}`;
};

const get_metrics_from_schema = async (http_prefix, source_type, source_value, metric_schema, metric_query) => {
    let metrics = await get_metrics(http_prefix, source_type, source_value);
    return metrics.find((m) => m.schema == metric_schema && m.query == metric_query); 
};

const get_default_metric = (metrics) => {
    let default_metric = metrics.find((m) => m.default_visible == true);
    if (default_metric != null) {
	return default_metric;
    }
    return metrics[0];
};

const metricsManager = function() {
    return {
	set_timeseries_groups_in_url,
	get_timeseries_groups_from_url,
	get_default_timeseries_groups,
	get_ts_group,
	get_ts_group_id,

	sources_types,
	get_source_type_from_value,
	get_current_page_source_type,

	get_sources,
	get_default_source,
	get_source_from_value,
	get_default_source_value,

	get_metrics,
	get_metrics_from_schema,
	get_default_metric,
    };
}();

export default metricsManager;
