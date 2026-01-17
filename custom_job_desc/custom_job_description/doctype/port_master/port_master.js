// Copyright (c) 2026, aits and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Port Master", {
// 	refresh(frm) {

// 	},
// });

// ----------------------------------------------------
// Central field mapping per Doctype
// ----------------------------------------------------
const PORT_FIELD_MAP = {
    "Quotation": {
        origin_country: "custom_country_of_origin",
        destination_country: "custom_country_of_destination",
        pol: "custom_pol",
        pod: "custom_pod"
    },
    "Sales Order": {
        origin_country: "custom_country_of_origin",
        destination_country: "custom_country_of_destination",
        pol: "custom_polaol",
        pod: "custom_podaod"
    },
    "Sales Invoice": {
        origin_country: "custom_country_of_origin",
        destination_country: "custom_country_of_destination",
        pol: "custom_pol",
        pod: "custom_pod"
    }
};

// ----------------------------------------------------
// Common reusable filter logic
// ----------------------------------------------------
function apply_port_filters(frm) {

    const config = PORT_FIELD_MAP[frm.doctype];
    if (!config) return;

    // -------- POL : filter by Origin Country --------
    frm.set_query(config.pol, () => {
        if (!frm.doc[config.origin_country]) return {};
        return {
            filters: {
                country: frm.doc[config.origin_country]
            }
        };
    });

    // -------- POD : filter by Destination Country --------
    frm.set_query(config.pod, () => {
        if (!frm.doc[config.destination_country]) return {};
        return {
            filters: {
                country: frm.doc[config.destination_country]
            }
        };
    });
}

// ----------------------------------------------------
// Bind logic to all required doctypes
// ----------------------------------------------------
Object.keys(PORT_FIELD_MAP).forEach(doctype => {
    frappe.ui.form.on(doctype, {

        refresh(frm) {
            apply_port_filters(frm);
        },

        custom_country_of_origin(frm) {
            const pol_field = PORT_FIELD_MAP[frm.doctype].pol;
            frm.set_value(pol_field, null);
            apply_port_filters(frm);
        },

        custom_country_of_destination(frm) {
            const pod_field = PORT_FIELD_MAP[frm.doctype].pod;
            frm.set_value(pod_field, null);
            apply_port_filters(frm);
        }
    });
});
