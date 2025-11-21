
let QuickSel = function(){

}
QuickSel.prototype.buildCSS = function(tag_name, parts){
	let exp_sep = " "
	return parts.join(exp_sep)
}
QuickSel.prototype.buildCSSPart = function(tag_name, attrs){
	let parts = ""
	parts += `//${tag_name}`
	if(attrs.length){
		parts += `[`
		for(let attr of attrs){
			let [attr_name, attr_comp, attr_val] = attr
			attr_val = attr_val.replace(/\"/g, "\\\"")
			if(attr_comp == "=")
				parts += `@${attr_name}="${attr_val}"`
			if(attr_comp == "contains")
				parts += `contains(@${attr_name},"${attr_val}")`
		}
		parts += `]`
	}
}
QuickSel.prototype.buildXpath = function(parts){
	let exp_sep = "//"
	return "//"+parts.join(exp_sep)
}
QuickSel.prototype.buildXpathPart = function(tag_name, attrs=[], preppend=""){
	let parts = ""
	if(preppend.length)
		parts += preppend
	parts += `${tag_name}`
	if(attrs.length){
		parts += `[`
		let attr_x = 0
		for(let attr of attrs){
			let [attr_name, attr_comp, attr_val] = attr
			if(attr_x)
				parts += ` and `
			attr_val = attr_val.replace(/\"/g, "\\\"")
			if(attr_comp == "")
				parts += `${attr_name}`
			if(attr_val.length < 30){
				if(attr_comp == "=")
					parts += `${attr_name}="${attr_val}"`
				if(attr_comp == "contains")
					parts += `contains(${attr_name},"${attr_val}")`
			}
			attr_x += 1
		}
		parts += `]`
	}
	return parts
}
QuickSel.prototype.buildSelector = function(parts, format){
	if(format == "xpath")
		return this.buildXpath(parts)
	if(format == "css")
		return this.buildXpath(parts)
}
QuickSel.prototype.getSelectorCount = function(selector, format){
	if(format == "xpath"){
		try {
			let result = document.evaluate(
				selector, document,
				null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
			)
			return result.snapshotLength
		} catch (ex) { }
	} else {
		let els = document.querySelectorAll(selector)
		return els.length
	}
}
QuickSel.prototype.getSelector = function(tag_name, attrs=[], format, preppend=""){
	if(format == "xpath")
		return this.buildXpathPart(tag_name, attrs, preppend)
	if(format == "css")
		return this.buildXpathPart(tag_name, attrs, preppend)
}
QuickSel.prototype.getSelectorCombinations = function*(el, tag_name, attrs=[], format, preppend="", idx=null){
	yield this.getSelector(tag_name, attrs, format, preppend)
	let offset
	if(idx != null)
		offset = idx + 1
	else {
		let parentChildren = Array.from(el.parentNode.children)
		offset = parentChildren.indexOf(el) + 1
	}
	// yield this.getSelector(tag_name, attrs, format, preppend)+`[${offset}]`
}
QuickSel.prototype.getUniqueTagNames = function(){
	return ["h1", "h2", "h3", "h4", "h5", "h6"]
}
QuickSel.prototype.getTagSelectors = function*(el, format, preppend="", idx=null){
	let tag_name = el.tagName.toLowerCase()
	yield* this.getSelectorCombinations(el, tag_name, [], format, preppend, idx)
}
QuickSel.prototype.getClassSelectors = function*(el, format, preppend="", idx=null){
	let tag_name = el.tagName.toLowerCase()
	let class_list = el.classList
	for(let class_name of class_list){
		for(let class_name2 of class_list){
			if(class_name != class_name2)
				yield* this.getSelectorCombinations(el, tag_name, [
					["@"+"class", "contains", class_name],
					["@"+"class", "contains", class_name2]
				], format, preppend, idx)
		}
	}
}
QuickSel.prototype.getAttrSelectors = function*(el, format, preppend="", idx=null){
	let tag_name = el.tagName.toLowerCase()
	let attr_list = el.attributes
	for(let attr of attr_list){
		yield* this.getSelectorCombinations(el, tag_name, [
			["@"+attr.name, "", ""]
		], format, preppend, idx)
		yield* this.getSelectorCombinations(el, tag_name, [
			["@"+attr.name, "=", attr.value]
		], format, preppend, idx)
		for(let attr2 of attr_list){
			if(attr.name != attr2.name)
				yield* this.getSelectorCombinations(el, tag_name, [
					["@"+attr.name, "=", attr.value],
					["@"+attr2.name, "=", attr2.value]
				], format, preppend, idx)
		}
	}
}
QuickSel.prototype.getTextSelectors = function*(el, format, preppend="", idx=null){
	if(format == "xpath"){
		let tag_name = el.tagName.toLowerCase()
		let text = ""
	    for(let node of el.childNodes){
	        if(node.nodeType === Node.TEXT_NODE)
	            text += node.textContent.trim()
	        break
	    }
	    if(text.length >= 2 && text.length < 50){
			yield* this.getSelectorCombinations(el, tag_name, [
				["text()", "=", text]
			], format, preppend, idx)
		}
	}
}
QuickSel.prototype.getElementSelectors = function*(el, format, preppend="", idx=null){
	yield* this.getTagSelectors(el, format, preppend, idx)
	yield* this.getClassSelectors(el, format, preppend, idx)
	yield* this.getAttrSelectors(el, format, preppend, idx)
	yield* this.getTextSelectors(el, format, preppend, idx)
}
QuickSel.prototype.getParentSelectors = function*(el, format, preppend=""){
	let associated_el = el.parentElement
	for (let i = 0; i <= 8; i++) {
		if(!associated_el)
			break
		yield* this.getElementSelectors(associated_el, format, preppend)
		associated_el = associated_el.parentElement
	}
}
QuickSel.prototype.getFollowingSiblingSelectors = function*(el, format, preppend=""){
	if(format == "xpath"){
		let associated_el = el.nextElementSibling
		for (let i = 0; i <= 5; i++) {
			if(!associated_el)
				break
			yield* this.getElementSelectors(associated_el, format, preppend)
			associated_el = associated_el.nextElementSibling
		}
	}
}
QuickSel.prototype.getPrecedingSiblingSelectors = function*(el, format, preppend=""){
	let associated_el = el.previousElementSibling
	for (let i = 0; i <= 5; i++) {
		if(!associated_el)
			break
		yield* this.getElementSelectors(associated_el, format, preppend)
		associated_el = associated_el.previousElementSibling
	}
}
QuickSel.prototype.getSelectors = function(el, format, min_count=1, max_count=10000, max_len=100, max_per_count=8){
	let selectors_checked = 0
	let selectors = []
	let selectors_uniques = {}
	let el_sels = [
		...this.getElementSelectors(el, format),
	]
	for(let el_sel of el_sels){
		let selector = this.buildSelector([el_sel], format)
		let count = this.getSelectorCount(selector, format)
		if(count >= min_count && count <= max_count && selector.length <= max_len){
			if(!(selector in selectors_uniques)){
				selectors.push([count, selector])
				selectors_uniques[selector] = count
			}
		}
		selectors_checked += 1
		if(selectors_checked > 1000)
			break
	}
	let ass_types = ["parent", "following", "preceding"]
	for(let ass_type of ass_types){

		let ass_sels
		if(ass_type == "parent")
			ass_sels = [...this.getParentSelectors(el, format)]
		if(ass_type == "following")
			ass_sels = [...this.getFollowingSiblingSelectors(el, format)]
		if(ass_type == "preceding")
			ass_sels = [...this.getPrecedingSiblingSelectors(el, format)]

		let add_sel = ""
		if(format == "xpath"){
			if(ass_type == "parent")
				add_sel = ""
			if(ass_type == "following")
				add_sel = "preceding-sibling::"
			if(ass_type == "preceding")
				add_sel = "following-sibling::"
		} else {
			if(ass_type == "parent")
				add_sel = ""
			if(ass_type == "following")
				add_sel = "preceding-sibling::"
			if(ass_type == "preceding")
				add_sel = "following-sibling::"
		}

		for(let ass_sel of ass_sels){
			for(let el_sel of el_sels){
				let selector = this.buildSelector([ass_sel, add_sel+el_sel], format)
				let count = this.getSelectorCount(selector, format)
				if(count >= min_count && count <= max_count && selector.length <= max_len){
					if(!(selector in selectors_uniques)){
						selectors.push([count, selector])
						selectors_uniques[selector] = count
					}
				}
				selectors_checked += 1
				if(selectors_checked > 1000)
					break
			}
			if(selectors_checked > 1000)
				break
		}
	}
	selectors.sort((c1, c2) => (c1[0] - c2[0]) * 10000 + (c1[1].length - c2[1].length))
	let selectors_by_count = {}
	for(let selector of selectors){
		let count = selector[0]
		if(!(count in selectors_by_count))
			selectors_by_count[count] = []
		if(selectors_by_count[count].length <= max_per_count)
			selectors_by_count[count].push(selector)
	}
	return selectors_by_count
}
// TEST METHOD - Add this at the end of quicksel.js
QuickSel.prototype.doTest = function() {
    return "QuickSel is working! Version 1.0 - " + new Date().toLocaleTimeString();
};

// Ensure global instance exists
if (typeof window.quicksel === 'undefined') {
    window.quicksel = new QuickSel();
    console.log('QuickSel instance created automatically');
}