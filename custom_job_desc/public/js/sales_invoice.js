// =======================================================
// Sales Invoice ITEM LOGIC (LIVE BUSINESS CALCULATION)
// =======================================================

frappe.ui.form.on("Sales Invoice Item", {
    items_add(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        row.custom_formula = 0; // reset
        frm.refresh_field("items");
    },

    custom_custom_rate(frm, cdt, cdn) {
        recalc_item_row(frm, locals[cdt][cdn]);
        update_custom_total_parent(frm);
    },

    custom_formula(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        toggle_custom_total_edit(frm, row);
        recalc_item_row(frm, row);
        update_custom_total_parent(frm);
    },

    custom_exchange_rate(frm, cdt, cdn) {
        recalc_item_row(frm, locals[cdt][cdn]);
        update_custom_total_parent(frm);
    },

    custom_total(frm, cdt, cdn) {
        // MANUAL MODE
        let row = locals[cdt][cdn];
        if (!row.custom_formula) {
            recalc_manual_row(frm, row);
        }
    }
});

function toggle_custom_total_edit(frm, row) {
    frm.fields_dict.items.grid.toggle_enable(
        "custom_total",
        !row.custom_formula
    );
}

function recalc_item_row(frm, row) {
    if (!row) return;

    let mode = (frm.doc.custom_mode || "").toUpperCase();
    let user_rate = flt(row.custom_custom_rate || 0);
    let exchange_rate = flt(row.custom_exchange_rate || 1);

    if (row.custom_formula) {
        let value = null;

        if (["SEA - LCL IMPORT", "SEA - LCL EXPORT"].includes(mode)) {
            value = flt(frm.doc.custom_total_cbm || 0) * user_rate;
        }
        else if (["AIR - IMPORT", "AIR - EXPORT"].includes(mode)) {
            let wt = Math.max(
                flt(frm.doc.custom_total_weight || 0),
                flt(frm.doc.custom_total_volume_weight || 0)
            );
            value = wt * user_rate;
        }

        if (value !== null) {
            row.custom_total = value;
        }
    }

    // INR calculation
    row.custom_total_value = flt(row.custom_total || 0) * exchange_rate;
    row.custom_total_in_inr = row.custom_total_value;

    // 🔑 CRITICAL BRIDGE (LIVE REPORT COMPATIBILITY)
    row.rate = row.custom_total_in_inr;

    frm.refresh_field("items");
}


function recalc_manual_row(frm, row) {
    let exchange_rate = flt(row.custom_exchange_rate || 1);

    row.custom_total_value = flt(row.custom_total || 0) * exchange_rate;
    row.custom_total_in_inr = row.custom_total_value;

    // 🔑 CRITICAL BRIDGE
    row.rate = row.custom_total_in_inr;

    frm.refresh_field("items");
    update_custom_total_parent(frm);
}


// =======================================================
// DIMENSION LOGIC (UNCHANGED, SAFE)
// =======================================================

frappe.ui.form.on("Sales Invoice", {
    custom_mode(frm) {
        (frm.doc.custom_dimension_details || []).forEach(r => {
            calculate_dimension_row(frm, r);
        });
        update_dimension_totals(frm);
    }
});

frappe.ui.form.on("Sales Invoice Dimension Details", {
    no_of_boxes(frm, cdt, cdn) { calculate_dimension_row(frm, locals[cdt][cdn]); },
    length_cm(frm, cdt, cdn) { calculate_dimension_row(frm, locals[cdt][cdn]); },
    breadth_cm(frm, cdt, cdn) { calculate_dimension_row(frm, locals[cdt][cdn]); },
    height_cm(frm, cdt, cdn) { calculate_dimension_row(frm, locals[cdt][cdn]); },
    weight_kg(frm) { update_dimension_totals(frm); }
});

function calculate_dimension_row(frm, row) {
    let L = flt(row.length_cm || 0);
    let B = flt(row.breadth_cm || 0);
    let H = flt(row.height_cm || 0);
    let boxes = flt(row.no_of_boxes || 1);

    row.cbm = (L * B * H / 1000000.0) * boxes;

    let divisor = (frm.doc.custom_mode || "").toUpperCase().startsWith("COURIER")
        ? 5000
        : 6000;

    row.volume_weight = (L * B * H / divisor) * boxes;

    update_dimension_totals(frm);
    frm.refresh_field("custom_dimension_details");
}

function update_dimension_totals(frm) {
    let total_cbm = 0,
        total_weight = 0,
        total_boxes = 0,
        total_volume_weight = 0;

    (frm.doc.custom_dimension_details || []).forEach(row => {
        total_cbm += flt(row.cbm || 0);
        total_weight += flt(row.weight_kg || 0);
        total_boxes += flt(row.no_of_boxes || 0);
        total_volume_weight += flt(row.volume_weight || 0);
    });

    total_cbm = flt(total_cbm, 2);

    frm.set_value("custom_total_no_of_boxes", total_boxes);
    frm.set_value("custom_totals_in_cbm", total_cbm);
    frm.set_value("custom_total_cbm", total_cbm);
    frm.set_value("custom_gross_weight", total_weight);
    frm.set_value("custom_total_weight", total_weight);
    frm.set_value("custom_total_volume_weight", total_volume_weight);
}

// =======================================================
// PARENT CUSTOM TOTAL (LIVE)
// =======================================================

function update_custom_total_parent(frm) {
    let total = 0;

    (frm.doc.items || []).forEach(item => {
        total += flt(item.custom_total_in_inr || 0);
    });

    frm.set_value("custom_total_inr", total);
}
