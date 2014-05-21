KityMinder.registerModule("LayoutModule", function () {
	var me = this;
	var clearPaper = function () {
		me._rc.remove();
		me._rc = new kity.Group();
		me._paper.addShape(this._rc);
	};
	kity.extendClass(Minder, {
		addLayoutStyle: function (name, style) {
			if (!this._layoutStyles) this._layoutStyles = {};
			this._layoutStyles[name] = style;
		},
		getLayoutStyle: function (name) {
			return this._layoutStyles[name];
		},

		getLayoutStyleItems: function () {
			var items = [];
			for (var key in this._layoutStyles) {
				items.push(key);
			}
			return items;
		},
		getCurrentStyle: function () {
			var _root = this.getRoot();
			return _root.getData("currentstyle");
		},
		setCurrentStyle: function (name) {
			var _root = this.getRoot();
			_root.setData("currentstyle", name);
			return name;
		},
		getCurrentLayoutStyle: function () {
			var curStyle = this.getCurrentStyle();
			return this.getLayoutStyle(curStyle).getCurrentLayoutStyle.call(this);
		},
		highlightNode: function (node) {
			var curStyle = this.getCurrentStyle();
			this.getLayoutStyle(curStyle).highlightNode.call(this, node);
		},
		initStyle: function () {
			var curStyle = this.getCurrentStyle();
			this._rc.remove();
			var transform = this._rc.transform;
			this._rc = new kity.Group();
			this._paper.addShape(this._rc);

			this._rc.transform = transform;
			this._rc._applyTransform();

			var _root = this.getRoot();
			_root.preTraverse(function (n) {
				n.clearLayout();
			});
			this.getLayoutStyle(curStyle).initStyle.call(this);
			this.fire('afterinitstyle');
		},
		appendChildNode: function (parent, node, index) {
			var curStyle = this.getCurrentStyle();
			this.getLayoutStyle(curStyle).appendChildNode.call(this, parent, node, index);
		},
		appendSiblingNode: function (sibling, node) {
			var curStyle = this.getCurrentStyle();
			this.getLayoutStyle(curStyle).appendSiblingNode.call(this, sibling, node);
		},
		removeNode: function (nodes) {
			var curStyle = this.getCurrentStyle();
			this.getLayoutStyle(curStyle).removeNode.call(this, nodes);
		},
		updateLayout: function (node) {
			var curStyle = this.getCurrentStyle();
			this.getLayoutStyle(curStyle).updateLayout.call(this, node);
		},
		expandNode: function (ico) {
			var curStyle = this.getCurrentStyle();
			this.getLayoutStyle(curStyle).expandNode.call(this, ico);
		}
	});
	kity.extendClass(MinderNode, {
		setLayout: function (k, v) {
			if (this._layout === undefined) {
				this._layout = {};
			}
			var _pros = this.getLayout();
			Utils.extend(_pros, {
				k: v
			});
			this._layout = _pros;
		},
		getLayout: function (k) {
			if (k === undefined) {
				return this._layout;
			}
			return this._layout[k];
		},
		clearLayout: function () {
			this._layout = {};
		}
	});
	var switchLayout = function (km, style) {
		var _root = km.getRoot();
		_root.preTraverse(function (n) {
			n.setPoint();
			n.getBgRc().clear();

		});
		km.setCurrentStyle(style);
		return style;
	};
	var SwitchLayoutCommand = kity.createClass("SwitchLayoutCommand", (function () {
		return {
			base: Command,
			execute: switchLayout,
			queryValue: function (km) {
				return km.getCurrentStyle();
			}
		};
	})());
	var AppendChildNodeCommand = kity.createClass("AppendChildNodeCommand", (function () {
		return {
			base: Command,
			execute: function (km, node) {
				var parent = km.getSelectedNode();

				if (!parent) {
					return null;
				}
				if (parent.getType() !== "root" && parent.getChildren().length !== 0 && !parent.isExpanded()) {
					km.expandNode(parent);
				}
				parent.expand();
				km.appendChildNode(parent, node);
				km.select(node, true);
				return node;
			},
			queryState: function (km) {
				var selectedNode = km.getSelectedNode();
				if (!selectedNode) {
					return -1;
				} else {
					return 0;
				}
			}
		};
	})());
	var AppendSiblingNodeCommand = kity.createClass("AppendSiblingNodeCommand", (function () {
		return {
			base: Command,
			execute: function (km, node) {
				var selectedNode = km.getSelectedNode();
				if (!selectedNode) {
					return null;
				}

				if (selectedNode.isRoot()) {
					node.setType("main");
					km.appendChildNode(selectedNode, node);
				} else {
					km.appendSiblingNode(selectedNode, node);
				}
				km.select(node, true);
				return node;
			},
			queryState: function (km) {
				var selectedNodes = km.getSelectedNodes();
				//没选中节点和单选root的时候返回不可执行
				if (selectedNodes.length === 0 || (selectedNodes.length === 1 && selectedNodes[0] === km.getRoot())) {
					return -1;
				} else {
					return 0;
				}
			}
		};
	})());
	var RemoveNodeCommand = kity.createClass("RemoveNodeCommand", (function () {
		return {
			base: Command,
			execute: function (km) {

				if (km.getRoot().children.length == 0) {
					return;
				}

				var selectedNodes = km.getSelectedNodes();
				var _root = km.getRoot();
				var _buffer = [];
				for (var i = 0; i < selectedNodes.length; i++) {
					_buffer.push(selectedNodes[i]);
				}
				do {
					var parent = _buffer[0].getParent();
					if (parent && _buffer.indexOf(parent) === -1) _buffer.push(parent);
					_buffer.shift();
				} while (_buffer.length > 1);
				km.removeNode(selectedNodes);
				km.select(_buffer[0]);
			},
			queryState: function (km) {
				var selectedNodes = km.getSelectedNodes();
				if (selectedNodes.length === 0 || (selectedNodes.length === 1 && selectedNodes[0] === km.getRoot())) {
					return -1;
				} else {
					return 0;
				}
			}
		};
	})());
	var EditNodeCommand = kity.createClass("EditNodeCommand", (function () {
		return {
			base: Command,
			execute: function (km) {
				var selectedNode = km.getSelectedNode();
				if (!selectedNode) {
					return null;
				}
				km.select(selectedNode, true);
				km.textEditNode(selectedNode);
			},
			queryState: function (km) {
				var selectedNode = km.getSelectedNode();
				if (!selectedNode) {
					return -1;
				} else {
					return 0;
				}
			},
			isNeedUndo: function () {
				return false;
			}
		};
	})());

	return {
		"commands": {
			"appendchildnode": AppendChildNodeCommand,
			"appendsiblingnode": AppendSiblingNodeCommand,
			"removenode": RemoveNodeCommand,
			"editnode": EditNodeCommand,
			"switchlayout": SwitchLayoutCommand
		},
		"events": {
			"ready": function () {
				this.setDefaultOptions('layoutstyle', this.getLayoutStyleItems());
				switchLayout(this, this.getOptions('defaultlayoutstyle'));
			},
			"click": function (e) {
				var ico = e.kityEvent.targetShape && e.kityEvent.targetShape.container;
				if (ico && ico.class === "shicon") {
					this.expandNode(ico);
					this.fire('contentchange');
				}
			},
			"resize": function (e) {
				clearTimeout(this._lastStyleResetTimeout);
				this._lastStyleResetTimeout = setTimeout(function () {
					this.updateLayout(this.getRoot());
				}.bind(this), 100);
			},
			"import": function (e) {
				this.initStyle();
			}
		},
		'contextmenu': [{
				label: this.getLang('node.appendsiblingnode'),
				exec: function () {
					this.execCommand('appendsiblingnode', new MinderNode(this.getLang('topic')))
				},
				cmdName: 'appendsiblingnode'
			}, {
				label: this.getLang('node.appendchildnode'),
				exec: function () {
					this.execCommand('appendchildnode', new MinderNode(this.getLang('topic')))
				},
				cmdName: 'appendchildnode'
			}, {
				label: this.getLang('node.editnode'),
				exec: function () {
					this.execCommand('editnode', null);
				},
				cmdName: 'editnode'
			}, {
				label: this.getLang('node.removenode'),
				cmdName: 'removenode'
			}, {
				divider: 1
			}

		],
		"defaultOptions": {
			"defaultlayoutstyle": "default",
			"node": {
				'appendsiblingnode': 'appendsiblingnode',
				'appendchildnode': 'appendchildnode',
				'editnode': 'editnode',
				'removenode': 'removenode'
			},
			'defaultExpand': {
				'defaultLayer': 0,
				'defaultSubShow': 0
			}
		}
	};
});