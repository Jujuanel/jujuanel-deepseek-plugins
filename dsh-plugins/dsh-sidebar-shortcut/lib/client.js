window.__ModuleLoader__.load({
	id: "dsh-sidebar-shortcut",
	factory: () => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const inject = ["layout"];
		function isApplePlatform() {
			const uaData = navigator.userAgentData;
			const raw = (uaData && uaData.platform) || navigator.platform || navigator.userAgent || "";
			return /mac|iphone|ipad|ipod/i.test(raw);
		}
		function apply(ctx) {
			const primaryModifier = isApplePlatform() ? "metaKey" : "ctrlKey";
			const onKeyDown = (event) => {
				const isB = event.code === "KeyB" || String(event.key || "").toLowerCase() === "b";
				if (!isB || event.altKey || event.shiftKey) return;
				if (!event[primaryModifier]) return;
				event.preventDefault();
				event.stopPropagation();
				if (event.repeat) return;
				ctx.layout.toggleSidebar();
			};
			window.addEventListener("keydown", onKeyDown, true);
			ctx.effect(() => () => window.removeEventListener("keydown", onKeyDown, true), "sidebar-shortcut: keydown listener");
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
