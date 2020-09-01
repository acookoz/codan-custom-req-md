/*global location */
sap.ui.define([
	"approve/req/customer/codan/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"approve/req/customer/codan/model/formatter",
	"sap/m/MessagePopover",
	"sap/m/MessagePopoverItem",
	"sap/m/MessageBox"
], function (BaseController, JSONModel, formatter, MessagePopover, MessagePopoverItem, MessageBox) {
	"use strict";

	return BaseController.extend("approve.req.customer.codan.controller.Detail", {

		formatter: formatter,
		oMessageManager: {},
		_oFactSheetComponent: undefined,
		_sRole: undefined,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			var oViewModel = new JSONModel({
				busy: false,
				delay: 0,
				selectedTab: "tab1",
				editMode: false,
				approvalResult: "",
				approveMode: false,
				financeApproval: false,
				accountingClerk: "",
				paymentTerms: ""
			});

			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
			this.getRouter().getRoute("approveObject").attachPatternMatched(this._onApproveObjectMatched, this);

			this.setModel(oViewModel, "detailView");

			this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));
			
			// Initialise the message manager
			this.oMessageManager = sap.ui.getCore().getMessageManager();
			this.setModel(this.oMessageManager.getMessageModel(), "message");
			this.oMessageManager.registerObject(this.getView(), true);
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Event handler when the share by E-Mail button has been clicked
		 * @public
		 */
		onShareEmailPress: function () {
			var oViewModel = this.getModel("detailView");

			sap.m.URLHelper.triggerEmail(
				null,
				oViewModel.getProperty("/shareSendEmailSubject"),
				oViewModel.getProperty("/shareSendEmailMessage")
			);
		},

		/**
		 * Event handler when the share in JAM button has been clicked
		 * @public
		 */
		onShareInJamPress: function () {
			var oViewModel = this.getModel("detailView"),
				oShareDialog = sap.ui.getCore().createComponent({
					name: "sap.collaboration.components.fiori.sharing.dialog",
					settings: {
						object: {
							id: location.href,
							share: oViewModel.getProperty("/shareOnJamTitle")
						}
					}
				});

			oShareDialog.open();
		},

		navigateToReq: function () {
			var oViewModel = this.getModel("detailView");
			oViewModel.setProperty("/selectedTab", "tabFactSheet");
		},
		
		onPressSubmit: function () {
			this._oFactSheetComponent.submit();
		},

		onPressSave: function () {
			this._oFactSheetComponent.save();
		},


		onApprove: function () {
			this._oFactSheetComponent.approve();
		},

		onReject: function () {
			this._oFactSheetComponent.reject();
		},

		/* =========================================================== */
		/* begin: internal methods                                     */
		/* =========================================================== */

		/**
		 * Binds the view to the object path and expands the aggregated line items.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_setupBinding: function (oEvent) {
			this._sObjectId = oEvent.getParameter("arguments").objectId;
			this.getModel().metadataLoaded().then(function () {
				var sObjectPath = this.getModel().createKey("Requests", {
					id: this._sObjectId
				});
				this._bindView("/" + sObjectPath);
			}.bind(this));
			this._setFactSheetComponent();
		},

		_onObjectMatched: function (oEvent) {
			// Reset mode
			this._sRole = "R"; // requestor
			this.getModel("detailView").setProperty("/approveMode", false);
			this.getModel("detailView").setProperty("/editMode", false); // Might be reset to true after binding 
			this._setupBinding(oEvent);
		},

		_onApproveObjectMatched: function (oEvent) {

			// Retrieve my authorisation level
			var oCommonModel = this.getOwnerComponent().getModel("common"),
				oDetailModel = this.getModel("detailView");

			// Reset mode
			this._sRole = "A"; // approver
			oDetailModel.setProperty("/approveMode", false); // Might be reset to true after below read
			oDetailModel.setProperty("/editMode", false);
			
			oCommonModel.metadataLoaded().then(function () {
				oCommonModel.read("/AppAuthorisations(application='CUSTOMER_REQ')", {
					success: function (data) {
						if (data.authorisation) {
							oDetailModel.setProperty("/approveMode", true);
							oDetailModel.setProperty("/financeApproval", data.authorisation === "FINANCE" || data.authorisation === "ADMIN");
						}
					}
				});
			});

			this._setupBinding(oEvent);
		},

		/**
		 * Binds the view to the object path. Makes sure that detail view displays
		 * a busy indicator while data for the corresponding element binding is loaded.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound to the view.
		 * @private
		 */
		_bindView: function (sObjectPath) {
			// Set busy indicator during view binding
			var oViewModel = this.getModel("detailView");

			// If the view was not bound yet its not busy, only if the binding requests data it is set to busy again
			oViewModel.setProperty("/busy", false);

			this._sObjectPath = sObjectPath;

			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function () {
						oViewModel.setProperty("/busy", true);
					},
					dataReceived: function () {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},

		_onBindingChange: function () {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding();

			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("detailObjectNotFound");
				// if object could not be found, the selection in the master list
				// does not make sense anymore.
				this.getOwnerComponent().oListSelector.clearMasterListSelection();
				return;
			}

			var sPath = oElementBinding.getPath(),
				oResourceBundle = this.getResourceBundle(),
				oObject = oView.getModel().getObject(sPath),
				sObjectId = oObject.id,
				sObjectName = oObject.name1,
				oViewModel = this.getModel("detailView");

			this.getOwnerComponent().oListSelector.selectAListItem(sPath);

			oViewModel.setProperty("/saveAsTileTitle", oResourceBundle.getText("shareSaveTileAppTitle", [sObjectName]));
			oViewModel.setProperty("/shareOnJamTitle", sObjectName);
			oViewModel.setProperty("/shareSendEmailSubject",
				oResourceBundle.getText("shareSendEmailObjectSubject", [sObjectId]));
			oViewModel.setProperty("/shareSendEmailMessage",
				oResourceBundle.getText("shareSendEmailObjectMessage", [sObjectName, sObjectId, location.href]));
		},

		_onMetadataLoaded: function () {
			// Store original busy indicator delay for the detail view
			var iOriginalViewBusyDelay = this.getView().getBusyIndicatorDelay(),
				oViewModel = this.getModel("detailView");

			// Make sure busy indicator is displayed immediately when
			// detail view is displayed for the first time
			oViewModel.setProperty("/delay", 0);

			// Binding the view will set it to not busy - so the view is always busy if it is not bound
			oViewModel.setProperty("/busy", true);
			// Restore original busy indicator delay for the detail view
			oViewModel.setProperty("/delay", iOriginalViewBusyDelay);
		},

		_setFactSheetComponent: function() {
			if (!this._oFactSheetComponent) {
				this._initializeFactSheetComponent();
			} else {
				this._oFactSheetComponent.setRole(this._sRole);
				this._oFactSheetComponent.setRequest({
					requestId: this._sObjectId
				});
			}
		},

		_initializeFactSheetComponent: function() {
			var oSemanticMessagesIndicator = this.byId("messagesIndicator");
			sap.ui.component({
				name: "factsheet.req.customer.codan",
				settings: {
					role: this._sRole, // Requestor or Approver (depending on route)
					request: {
						requestId: this._sObjectId
					},
					hideCustomerHeader: true, // We provide our own
					messagesButton: oSemanticMessagesIndicator,
					// ready: this._onFactsheetReady.bind(this),
					// saved: this.onRequestSaved.bind(this),
					submitted: this._afterRequestStatusChanged.bind(this),
					approved: this._afterRequestStatusChanged.bind(this),
					rejected: this._afterRequestStatusChanged.bind(this)
					// messages: this.onMessages.bind(this)
				},
				async: true,
				manifestFirst : true  //deprecated from 1.49+
				// manifest : true    //SAPUI5 >= 1.49
			}).then(function(oComponent){
				this._oFactSheetComponent = oComponent;
				this.byId("componentFactSheet").setComponent(this._oFactSheetComponent);
			}.bind(this)).catch(function(oError) {
				jQuery.sap.log.error(oError);
			});
		},
		
		_afterRequestStatusChanged: function() {
			var oODataModel = this.getModel();
			oODataModel.refresh();
		},
		
		displayMessagesPopover: function (oEvent) {
			var oMessagesButton = oEvent ? oEvent.getSource() : this.getView().byId("detailPage")
				.getAggregation("messagesIndicator").getAggregation("_control");

			if (!this._messagePopover) {
				this._messagePopover = new MessagePopover({
					items: {
						path: "message>/",
						template: new MessagePopoverItem({
							description: "{message>description}",
							type: "{message>type}",
							title: "{message>message}",
							subtitle: "{message>subtitle}"
						})
					},
					initiallyExpanded: true
				});
				oMessagesButton.addDependent(this._messagePopover);
			}

			if (oEvent || !this._messagePopover.isOpen()) {
				this._messagePopover.toggle(oMessagesButton);
			}
		}

	});

});