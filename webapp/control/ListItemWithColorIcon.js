sap.ui.define([
	"sap/m/StandardListItem",
	"sap/m/StandardListItemRenderer"
], function(SLI, SLIR) {
	"use strict";
	
	return SLI.extend("approve.req.customer.codan.control.ListItemWithColorIcon", {
		renderer: function(oRm, oControl) {
			SLIR.render(oRm, oControl);
		},
		onAfterRendering: function() {
			if (SLI.prototype.onAfterRendering) {
				SLI.prototype.onAfterRendering.apply(this, arguments);
			}
			self = this;
			this.$().find('.sapUiIcon').each(function() {
				var iconClass = "z" + self.getInfoState() + "Icon";
				$(this).addClass(iconClass);
			})
		}
	});
});