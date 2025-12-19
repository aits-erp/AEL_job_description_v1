import frappe
from frappe.model.document import Document
from frappe.utils import flt

class SalesInvoice(Document):

    def validate(self):
        # 1. Dimension row calculations
        self.update_dimension_rows()

        # 2. Parent dimension totals
        self.update_dimension_totals()

        # 3. Item-level business calculations
        self.update_custom_item_totals()

        # 4. Push final INR value into standard rate
        self.sync_standard_rate_from_custom_total()

        # 5. Parent custom INR total (for reference / print)
        self.update_custom_total_parent()

    # -----------------------------------------------------------
    # ITEM TOTAL CALCULATIONS (BUSINESS LOGIC)
    # -----------------------------------------------------------
    def update_custom_item_totals(self):
        mode = (self.custom_mode or "").upper()

        for item in self.items:
            user_rate = flt(item.custom_custom_rate or 0)
            exchange_rate = flt(item.custom_exchange_rate or 1)

            # ---------- FORMULA PATH ----------
            if item.custom_formula:
                calculated = None

                if mode in ("SEA - LCL IMPORT", "SEA - LCL EXPORT"):
                    calculated = flt(self.custom_total_cbm) * user_rate

                elif mode in ("AIR - IMPORT", "AIR - EXPORT"):
                    chargeable_weight = max(
                        flt(self.custom_total_weight),
                        flt(self.custom_total_volume_weight)
                    )
                    calculated = chargeable_weight * user_rate

                if calculated is not None:
                    item.custom_total = calculated

            # ---------- MANUAL PATH ----------
            # If custom_formula is OFF, user is expected to manually enter custom_total

            # ---------- INR CONVERSION ----------
            item.custom_total_value = flt(item.custom_total or 0) * exchange_rate
            item.custom_total_in_inr = item.custom_total_value

    # -----------------------------------------------------------
    # DIMENSION ROW CALCULATION
    # -----------------------------------------------------------
    def update_dimension_rows(self):
        mode = (self.custom_mode or "").upper()

        for row in (self.custom_dimension_details or []):
            L = flt(row.length_cm or 0)
            B = flt(row.breadth_cm or 0)
            H = flt(row.height_cm or 0)
            boxes = flt(row.no_of_boxes or 1)

            row.cbm = (L * B * H / 1000000.0) * boxes

            divisor = 5000.0 if mode.startswith("COURIER") else 6000.0
            row.volume_weight = (L * B * H / divisor) * boxes

    # -----------------------------------------------------------
    # PARENT DIMENSION TOTALS
    # -----------------------------------------------------------
    def update_dimension_totals(self):
        total_cbm = 0.0
        total_weight = 0.0
        total_volume_weight = 0.0
        total_boxes = 0.0

        for row in (self.custom_dimension_details or []):
            total_cbm += flt(row.cbm or 0)
            total_weight += flt(row.weight_kg or 0)
            total_volume_weight += flt(row.volume_weight or 0)
            total_boxes += flt(row.no_of_boxes or 0)

        total_cbm = flt(total_cbm, 2)

        self.custom_totals_in_cbm = total_cbm
        self.custom_gross_weight = total_weight

        self.custom_total_cbm = total_cbm
        self.custom_total_weight = total_weight
        self.custom_total_volume_weight = total_volume_weight
        self.custom_total_no_of_boxes = total_boxes

    # -----------------------------------------------------------
    # 🔑 SYNC STANDARD RATE (REPORT-SAFE)
    # -----------------------------------------------------------
    def sync_standard_rate_from_custom_total(self):
        """
        Push final business INR value into standard rate
        so ERPNext reports, totals, SO, SI remain correct.
        Qty is untouched.
        """
        for item in self.items:
            final_inr = flt(item.custom_total_in_inr or 0)

            # Do not force rate if value is zero
            if final_inr:
                item.rate = final_inr

    # -----------------------------------------------------------
    # PARENT CUSTOM INR TOTAL (REFERENCE)
    # -----------------------------------------------------------
    def update_custom_total_parent(self):
        self.custom_total_inr = sum(
            flt(item.custom_total_in_inr or 0)
            for item in self.items
        )
