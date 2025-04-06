// New Block - Updated April 6, 2025
function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
let src_url_equal_anchor;
function src_url_equal(element_src, url) {
    if (!src_url_equal_anchor) {
        src_url_equal_anchor = document.createElement('a');
    }
    src_url_equal_anchor.href = url;
    return element_src === src_url_equal_anchor.href;
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function null_to_empty(value) {
    return value == null ? '' : value;
}

// Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
// at the end of hydration without touching the remaining nodes.
let is_hydrating = false;
function start_hydrating() {
    is_hydrating = true;
}
function end_hydrating() {
    is_hydrating = false;
}
function upper_bound(low, high, key, value) {
    // Return first index of value larger than input value in the range [low, high)
    while (low < high) {
        const mid = low + ((high - low) >> 1);
        if (key(mid) <= value) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    return low;
}
function init_hydrate(target) {
    if (target.hydrate_init)
        return;
    target.hydrate_init = true;
    // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
    let children = target.childNodes;
    // If target is <head>, there may be children without claim_order
    if (target.nodeName === 'HEAD') {
        const myChildren = [];
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (node.claim_order !== undefined) {
                myChildren.push(node);
            }
        }
        children = myChildren;
    }
    /*
    * Reorder claimed children optimally.
    * We can reorder claimed children optimally by finding the longest subsequence of
    * nodes that are already claimed in order and only moving the rest. The longest
    * subsequence of nodes that are claimed in order can be found by
    * computing the longest increasing subsequence of .claim_order values.
    *
    * This algorithm is optimal in generating the least amount of reorder operations
    * possible.
    *
    * Proof:
    * We know that, given a set of reordering operations, the nodes that do not move
    * always form an increasing subsequence, since they do not move among each other
    * meaning that they must be already ordered among each other. Thus, the maximal
    * set of nodes that do not move form a longest increasing subsequence.
    */
    // Compute longest increasing subsequence
    // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
    const m = new Int32Array(children.length + 1);
    // Predecessor indices + 1
    const p = new Int32Array(children.length);
    m[0] = -1;
    let longest = 0;
    for (let i = 0; i < children.length; i++) {
        const current = children[i].claim_order;
        // Find the largest subsequence length such that it ends in a value less than our current value
        // upper_bound returns first greater value, so we subtract one
        // with fast path for when we are on the current longest subsequence
        const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
        p[i] = m[seqLen] + 1;
        const newLen = seqLen + 1;
        // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
        m[newLen] = i;
        longest = Math.max(newLen, longest);
    }
    // The longest increasing subsequence of nodes (initially reversed)
    const lis = [];
    // The rest of the nodes, nodes that will be moved
    const toMove = [];
    let last = children.length - 1;
    for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
        lis.push(children[cur - 1]);
        for (; last >= cur; last--) {
            toMove.push(children[last]);
        }
        last--;
    }
    for (; last >= 0; last--) {
        toMove.push(children[last]);
    }
    lis.reverse();
    // We sort the nodes being moved to guarantee that their insertion order matches the claim order
    toMove.sort((a, b) => a.claim_order - b.claim_order);
    // Finally, we move the nodes
    for (let i = 0, j = 0; i < toMove.length; i++) {
        while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
            j++;
        }
        const anchor = j < lis.length ? lis[j] : null;
        target.insertBefore(toMove[i], anchor);
    }
}
function append_hydration(target, node) {
    if (is_hydrating) {
        init_hydrate(target);
        if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentNode !== target))) {
            target.actual_end_child = target.firstChild;
        }
        // Skip nodes of undefined ordering
        while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
            target.actual_end_child = target.actual_end_child.nextSibling;
        }
        if (node !== target.actual_end_child) {
            // We only insert if the ordering of this node should be modified or the parent node is not target
            if (node.claim_order !== undefined || node.parentNode !== target) {
                target.insertBefore(node, target.actual_end_child);
            }
        }
        else {
            target.actual_end_child = node.nextSibling;
        }
    }
    else if (node.parentNode !== target || node.nextSibling !== null) {
        target.appendChild(node);
    }
}
function insert_hydration(target, node, anchor) {
    if (is_hydrating && !anchor) {
        append_hydration(target, node);
    }
    else if (node.parentNode !== target || node.nextSibling != anchor) {
        target.insertBefore(node, anchor || null);
    }
}
function detach(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function init_claim_info(nodes) {
    if (nodes.claim_info === undefined) {
        nodes.claim_info = { last_index: 0, total_claimed: 0 };
    }
}
function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
    // Try to find nodes in an order such that we lengthen the longest increasing subsequence
    init_claim_info(nodes);
    const resultNode = (() => {
        // We first try to find an element after the previous one
        for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                return node;
            }
        }
        // Otherwise, we try to find one before
        // We iterate in reverse so that we don't go too far back
        for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                else if (replacement === undefined) {
                    // Since we spliced before the last_index, we decrease it
                    nodes.claim_info.last_index--;
                }
                return node;
            }
        }
        // If we can't find any matching node, we create a new one
        return createNode();
    })();
    resultNode.claim_order = nodes.claim_info.total_claimed;
    nodes.claim_info.total_claimed += 1;
    return resultNode;
}
function claim_element_base(nodes, name, attributes, create_element) {
    return claim_node(nodes, (node) => node.nodeName === name, (node) => {
        const remove = [];
        for (let j = 0; j < node.attributes.length; j++) {
            const attribute = node.attributes[j];
            if (!attributes[attribute.name]) {
                remove.push(attribute.name);
            }
        }
        remove.forEach(v => node.removeAttribute(v));
        return undefined;
    }, () => create_element(name));
}
function claim_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, element);
}
function claim_text(nodes, data) {
    return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
        const dataStr = '' + data;
        if (node.data.startsWith(dataStr)) {
            if (node.data.length !== dataStr.length) {
                return node.splitText(dataStr.length);
            }
        }
        else {
            node.data = dataStr;
        }
    }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
    );
}
function claim_space(nodes) {
    return claim_text(nodes, ' ');
}
function set_data(text, data) {
    data = '' + data;
    if (text.data === data)
        return;
    text.data = data;
}
function set_style(node, key, value, important) {
    if (value == null) {
        node.style.removeProperty(key);
    }
    else {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
}

let current_component;
function set_current_component(component) {
    current_component = component;
}

const dirty_components = [];
const binding_callbacks = [];
let render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = /* @__PURE__ */ Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    // Do not reenter flush while dirty components are updated, as this can
    // result in an infinite loop. Instead, let the inner flush handle it.
    // Reentrancy is ok afterwards for bindings etc.
    if (flushidx !== 0) {
        return;
    }
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        try {
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
        }
        catch (e) {
            // reset dirty state to not end up in a deadlocked state and then rethrow
            dirty_components.length = 0;
            flushidx = 0;
            throw e;
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    seen_callbacks.clear();
    set_current_component(saved_component);
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 */
function flush_render_callbacks(fns) {
    const filtered = [];
    const targets = [];
    render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
    targets.forEach((c) => c());
    render_callbacks = filtered;
}
const outroing = new Set();
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
            // if the component was destroyed immediately
            // it will update the `$$.on_destroy` reference to `null`.
            // the destructured on_destroy may still reference to the old array
            if (component.$$.on_destroy) {
                component.$$.on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        flush_render_callbacks($$.after_update);
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: [],
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            start_hydrating();
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        end_hydrating();
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        if (!is_function(callback)) {
            return noop;
        }
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/* generated by Svelte v3.59.1 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[18] = list[i];
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[18] = list[i];
	return child_ctx;
}

// (426:8) {#if modalOpen && selectedGame}
function create_if_block(ctx) {
	let div3;
	let div2;
	let div0;
	let h2;

	let t0_value = (/*isArabic*/ ctx[0]
	? /*selectedGame*/ ctx[2].nameAr
	: /*selectedGame*/ ctx[2].name) + "";

	let t0;
	let t1;
	let button;
	let t2;
	let button_aria_label_value;
	let t3;
	let div1;
	let section0;
	let h30;
	let t4_value = (/*isArabic*/ ctx[0] ? 'الوصف:' : 'Description:') + "";
	let t4;
	let t5;
	let p0;

	let t6_value = (/*isArabic*/ ctx[0]
	? /*selectedGame*/ ctx[2].descriptionAr
	: /*selectedGame*/ ctx[2].description) + "";

	let t6;
	let t7;
	let section1;
	let h31;
	let t8_value = (/*isArabic*/ ctx[0] ? 'كيفية اللعب:' : 'How to Play:') + "";
	let t8;
	let t9;
	let ol0;
	let t10;
	let section2;
	let h32;
	let t11_value = (/*isArabic*/ ctx[0] ? 'المتطلبات:' : 'Requirements:') + "";
	let t11;
	let t12;
	let p1;

	let t13_value = (/*isArabic*/ ctx[0]
	? /*selectedGame*/ ctx[2].requirementsAr
	: /*selectedGame*/ ctx[2].requirements) + "";

	let t13;
	let t14;
	let section3;
	let h33;
	let t15_value = (/*isArabic*/ ctx[0] ? 'القواعد:' : 'Rules:') + "";
	let t15;
	let t16;
	let ol1;
	let mounted;
	let dispose;

	let each_value_1 = /*isArabic*/ ctx[0]
	? /*selectedGame*/ ctx[2].howToPlayAr
	: /*selectedGame*/ ctx[2].howToPlayEn;

	let each_blocks_1 = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	let each_value = /*isArabic*/ ctx[0]
	? /*selectedGame*/ ctx[2].rulesAr
	: /*selectedGame*/ ctx[2].rulesEn;

	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div3 = element("div");
			div2 = element("div");
			div0 = element("div");
			h2 = element("h2");
			t0 = text(t0_value);
			t1 = space();
			button = element("button");
			t2 = text("×");
			t3 = space();
			div1 = element("div");
			section0 = element("section");
			h30 = element("h3");
			t4 = text(t4_value);
			t5 = space();
			p0 = element("p");
			t6 = text(t6_value);
			t7 = space();
			section1 = element("section");
			h31 = element("h3");
			t8 = text(t8_value);
			t9 = space();
			ol0 = element("ol");

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].c();
			}

			t10 = space();
			section2 = element("section");
			h32 = element("h3");
			t11 = text(t11_value);
			t12 = space();
			p1 = element("p");
			t13 = text(t13_value);
			t14 = space();
			section3 = element("section");
			h33 = element("h3");
			t15 = text(t15_value);
			t16 = space();
			ol1 = element("ol");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			div3 = claim_element(nodes, "DIV", { class: true });
			var div3_nodes = children(div3);

			div2 = claim_element(div3_nodes, "DIV", {
				class: true,
				role: true,
				"aria-modal": true,
				"aria-labelledby": true
			});

			var div2_nodes = children(div2);
			div0 = claim_element(div2_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			h2 = claim_element(div0_nodes, "H2", { id: true, class: true });
			var h2_nodes = children(h2);
			t0 = claim_text(h2_nodes, t0_value);
			h2_nodes.forEach(detach);
			t1 = claim_space(div0_nodes);
			button = claim_element(div0_nodes, "BUTTON", { class: true, "aria-label": true });
			var button_nodes = children(button);
			t2 = claim_text(button_nodes, "×");
			button_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t3 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			section0 = claim_element(div1_nodes, "SECTION", { class: true });
			var section0_nodes = children(section0);
			h30 = claim_element(section0_nodes, "H3", { class: true });
			var h30_nodes = children(h30);
			t4 = claim_text(h30_nodes, t4_value);
			h30_nodes.forEach(detach);
			t5 = claim_space(section0_nodes);
			p0 = claim_element(section0_nodes, "P", {});
			var p0_nodes = children(p0);
			t6 = claim_text(p0_nodes, t6_value);
			p0_nodes.forEach(detach);
			section0_nodes.forEach(detach);
			t7 = claim_space(div1_nodes);
			section1 = claim_element(div1_nodes, "SECTION", { class: true });
			var section1_nodes = children(section1);
			h31 = claim_element(section1_nodes, "H3", { class: true });
			var h31_nodes = children(h31);
			t8 = claim_text(h31_nodes, t8_value);
			h31_nodes.forEach(detach);
			t9 = claim_space(section1_nodes);
			ol0 = claim_element(section1_nodes, "OL", { class: true });
			var ol0_nodes = children(ol0);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				each_blocks_1[i].l(ol0_nodes);
			}

			ol0_nodes.forEach(detach);
			section1_nodes.forEach(detach);
			t10 = claim_space(div1_nodes);
			section2 = claim_element(div1_nodes, "SECTION", { class: true });
			var section2_nodes = children(section2);
			h32 = claim_element(section2_nodes, "H3", { class: true });
			var h32_nodes = children(h32);
			t11 = claim_text(h32_nodes, t11_value);
			h32_nodes.forEach(detach);
			t12 = claim_space(section2_nodes);
			p1 = claim_element(section2_nodes, "P", {});
			var p1_nodes = children(p1);
			t13 = claim_text(p1_nodes, t13_value);
			p1_nodes.forEach(detach);
			section2_nodes.forEach(detach);
			t14 = claim_space(div1_nodes);
			section3 = claim_element(div1_nodes, "SECTION", { class: true });
			var section3_nodes = children(section3);
			h33 = claim_element(section3_nodes, "H3", { class: true });
			var h33_nodes = children(h33);
			t15 = claim_text(h33_nodes, t15_value);
			h33_nodes.forEach(detach);
			t16 = claim_space(section3_nodes);
			ol1 = claim_element(section3_nodes, "OL", { class: true });
			var ol1_nodes = children(ol1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(ol1_nodes);
			}

			ol1_nodes.forEach(detach);
			section3_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h2, "id", "modal-title");
			attr(h2, "class", "svelte-ll3htz");
			attr(button, "class", "close-button svelte-ll3htz");
			attr(button, "aria-label", button_aria_label_value = /*isArabic*/ ctx[0] ? "إغلاق" : "Close");
			attr(div0, "class", "modal-header svelte-ll3htz");
			attr(h30, "class", "svelte-ll3htz");
			attr(section0, "class", "svelte-ll3htz");
			attr(h31, "class", "svelte-ll3htz");
			attr(ol0, "class", "svelte-ll3htz");
			attr(section1, "class", "svelte-ll3htz");
			attr(h32, "class", "svelte-ll3htz");
			attr(section2, "class", "svelte-ll3htz");
			attr(h33, "class", "svelte-ll3htz");
			attr(ol1, "class", "svelte-ll3htz");
			attr(section3, "class", "svelte-ll3htz");
			attr(div1, "class", "modal-content svelte-ll3htz");
			attr(div2, "class", "modal svelte-ll3htz");
			attr(div2, "role", "dialog");
			attr(div2, "aria-modal", "true");
			attr(div2, "aria-labelledby", "modal-title");
			attr(div3, "class", "modal-overlay svelte-ll3htz");
		},
		m(target, anchor) {
			insert_hydration(target, div3, anchor);
			append_hydration(div3, div2);
			append_hydration(div2, div0);
			append_hydration(div0, h2);
			append_hydration(h2, t0);
			append_hydration(div0, t1);
			append_hydration(div0, button);
			append_hydration(button, t2);
			append_hydration(div2, t3);
			append_hydration(div2, div1);
			append_hydration(div1, section0);
			append_hydration(section0, h30);
			append_hydration(h30, t4);
			append_hydration(section0, t5);
			append_hydration(section0, p0);
			append_hydration(p0, t6);
			append_hydration(div1, t7);
			append_hydration(div1, section1);
			append_hydration(section1, h31);
			append_hydration(h31, t8);
			append_hydration(section1, t9);
			append_hydration(section1, ol0);

			for (let i = 0; i < each_blocks_1.length; i += 1) {
				if (each_blocks_1[i]) {
					each_blocks_1[i].m(ol0, null);
				}
			}

			append_hydration(div1, t10);
			append_hydration(div1, section2);
			append_hydration(section2, h32);
			append_hydration(h32, t11);
			append_hydration(section2, t12);
			append_hydration(section2, p1);
			append_hydration(p1, t13);
			append_hydration(div1, t14);
			append_hydration(div1, section3);
			append_hydration(section3, h33);
			append_hydration(h33, t15);
			append_hydration(section3, t16);
			append_hydration(section3, ol1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(ol1, null);
				}
			}

			if (!mounted) {
				dispose = [
					listen(button, "click", /*closeModal*/ ctx[4]),
					listen(button, "keydown", /*handleCloseKeydown*/ ctx[8]),
					listen(div3, "click", /*handleOutsideClick*/ ctx[9]),
					listen(div3, "keydown", /*handleModalKeydown*/ ctx[10])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*isArabic, selectedGame*/ 5 && t0_value !== (t0_value = (/*isArabic*/ ctx[0]
			? /*selectedGame*/ ctx[2].nameAr
			: /*selectedGame*/ ctx[2].name) + "")) set_data(t0, t0_value);

			if (dirty & /*isArabic*/ 1 && button_aria_label_value !== (button_aria_label_value = /*isArabic*/ ctx[0] ? "إغلاق" : "Close")) {
				attr(button, "aria-label", button_aria_label_value);
			}

			if (dirty & /*isArabic*/ 1 && t4_value !== (t4_value = (/*isArabic*/ ctx[0] ? 'الوصف:' : 'Description:') + "")) set_data(t4, t4_value);

			if (dirty & /*isArabic, selectedGame*/ 5 && t6_value !== (t6_value = (/*isArabic*/ ctx[0]
			? /*selectedGame*/ ctx[2].descriptionAr
			: /*selectedGame*/ ctx[2].description) + "")) set_data(t6, t6_value);

			if (dirty & /*isArabic*/ 1 && t8_value !== (t8_value = (/*isArabic*/ ctx[0] ? 'كيفية اللعب:' : 'How to Play:') + "")) set_data(t8, t8_value);

			if (dirty & /*isArabic, selectedGame*/ 5) {
				each_value_1 = /*isArabic*/ ctx[0]
				? /*selectedGame*/ ctx[2].howToPlayAr
				: /*selectedGame*/ ctx[2].howToPlayEn;

				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks_1[i]) {
						each_blocks_1[i].p(child_ctx, dirty);
					} else {
						each_blocks_1[i] = create_each_block_1(child_ctx);
						each_blocks_1[i].c();
						each_blocks_1[i].m(ol0, null);
					}
				}

				for (; i < each_blocks_1.length; i += 1) {
					each_blocks_1[i].d(1);
				}

				each_blocks_1.length = each_value_1.length;
			}

			if (dirty & /*isArabic*/ 1 && t11_value !== (t11_value = (/*isArabic*/ ctx[0] ? 'المتطلبات:' : 'Requirements:') + "")) set_data(t11, t11_value);

			if (dirty & /*isArabic, selectedGame*/ 5 && t13_value !== (t13_value = (/*isArabic*/ ctx[0]
			? /*selectedGame*/ ctx[2].requirementsAr
			: /*selectedGame*/ ctx[2].requirements) + "")) set_data(t13, t13_value);

			if (dirty & /*isArabic*/ 1 && t15_value !== (t15_value = (/*isArabic*/ ctx[0] ? 'القواعد:' : 'Rules:') + "")) set_data(t15, t15_value);

			if (dirty & /*isArabic, selectedGame*/ 5) {
				each_value = /*isArabic*/ ctx[0]
				? /*selectedGame*/ ctx[2].rulesAr
				: /*selectedGame*/ ctx[2].rulesEn;

				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(ol1, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		d(detaching) {
			if (detaching) detach(div3);
			destroy_each(each_blocks_1, detaching);
			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (444:32) {#each (isArabic ? selectedGame.howToPlayAr : selectedGame.howToPlayEn) as step}
function create_each_block_1(ctx) {
	let li;
	let t_value = /*step*/ ctx[18] + "";
	let t;

	return {
		c() {
			li = element("li");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			li = claim_element(nodes, "LI", { class: true });
			var li_nodes = children(li);
			t = claim_text(li_nodes, t_value);
			li_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(li, "class", "svelte-ll3htz");
		},
		m(target, anchor) {
			insert_hydration(target, li, anchor);
			append_hydration(li, t);
		},
		p(ctx, dirty) {
			if (dirty & /*isArabic, selectedGame*/ 5 && t_value !== (t_value = /*step*/ ctx[18] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(li);
		}
	};
}

// (457:32) {#each (isArabic ? selectedGame.rulesAr : selectedGame.rulesEn) as step}
function create_each_block(ctx) {
	let li;
	let t_value = /*step*/ ctx[18] + "";
	let t;

	return {
		c() {
			li = element("li");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			li = claim_element(nodes, "LI", { class: true });
			var li_nodes = children(li);
			t = claim_text(li_nodes, t_value);
			li_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(li, "class", "svelte-ll3htz");
		},
		m(target, anchor) {
			insert_hydration(target, li, anchor);
			append_hydration(li, t);
		},
		p(ctx, dirty) {
			if (dirty & /*isArabic, selectedGame*/ 5 && t_value !== (t_value = /*step*/ ctx[18] + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(li);
		}
	};
}

function create_fragment(ctx) {
	let main;
	let div20;
	let header;
	let h1;
	let t0_value = (/*isArabic*/ ctx[0] ? 'ليلة الألعاب' : 'Game Night') + "";
	let t0;
	let t1;
	let p;

	let t2_value = (/*isArabic*/ ctx[0]
	? 'مرة أو مرتين حسب جدول فعاليات باب. التسجيل عبر مجموعة الواتساب ضروري للحضور.'
	: 'Twice or once depends on Bab\'s activity schedule. Registration through the WhatsApp group is a must to attend.') + "";

	let t2;
	let t3;
	let div0;
	let a;
	let img;
	let img_src_value;
	let t4;

	let t5_value = (/*isArabic*/ ctx[0]
	? 'مجموعة الواتساب'
	: 'WhatsApp Group') + "";

	let t5;
	let t6;
	let button0;
	let t7_value = (/*isArabic*/ ctx[0] ? 'English' : 'العربية') + "";
	let t7;
	let button0_aria_label_value;
	let t8;
	let div19;
	let div6;
	let div5;
	let div1;
	let t9;
	let t10;
	let div2;
	let t11;
	let t12;
	let ul0;
	let li0;
	let t13;
	let t14;
	let li1;
	let t15;
	let t16;
	let li2;
	let t17;
	let t18;
	let li3;
	let t19;
	let t20;
	let li4;
	let t21;
	let t22;
	let ul1;
	let li5;
	let t23;
	let t24;
	let li6;
	let t25;
	let t26;
	let li7;
	let t27;
	let t28;
	let li8;
	let t29;
	let t30;
	let li9;
	let t31;
	let t32;
	let div3;
	let t33;
	let t34;
	let div4;
	let t35;
	let t36;
	let ul2;
	let li10;
	let t37;
	let t38;
	let li11;
	let t39;
	let t40;
	let ul3;
	let li12;
	let t41;
	let t42;
	let li13;
	let t43;
	let t44;
	let button1;
	let t45_value = (/*isArabic*/ ctx[0] ? "شيتهيد" : "Shithead") + "";
	let t45;
	let button1_aria_label_value;
	let t46;
	let div12;
	let div11;
	let div7;
	let t47;
	let t48;
	let div8;
	let t49;
	let t50;
	let ul4;
	let li14;
	let t51;
	let t52;
	let li15;
	let t53;
	let t54;
	let li16;
	let t55;
	let t56;
	let li17;
	let t57;
	let t58;
	let li18;
	let t59;
	let t60;
	let ul5;
	let li19;
	let t61;
	let t62;
	let li20;
	let t63;
	let t64;
	let li21;
	let t65;
	let t66;
	let li22;
	let t67;
	let t68;
	let li23;
	let t69;
	let t70;
	let div9;
	let t71;
	let t72;
	let div10;
	let t73;
	let t74;
	let ul6;
	let li24;
	let t75;
	let t76;
	let li25;
	let t77;
	let t78;
	let ul7;
	let li26;
	let t79;
	let t80;
	let li27;
	let t81;
	let t82;
	let button2;
	let t83_value = (/*isArabic*/ ctx[0] ? "سفنز" : "Sevens") + "";
	let t83;
	let button2_aria_label_value;
	let t84;
	let div18;
	let div17;
	let div13;
	let t85;
	let t86;
	let div14;
	let t87;
	let t88;
	let ul8;
	let li28;
	let t89;
	let t90;
	let li29;
	let t91;
	let t92;
	let li30;
	let t93;
	let t94;
	let li31;
	let t95;
	let t96;
	let li32;
	let t97;
	let t98;
	let ul9;
	let li33;
	let t99;
	let t100;
	let li34;
	let t101;
	let t102;
	let li35;
	let t103;
	let t104;
	let li36;
	let t105;
	let t106;
	let li37;
	let t107;
	let t108;
	let div15;
	let t109;
	let t110;
	let div16;
	let t111;
	let t112;
	let ul10;
	let li38;
	let t113;
	let t114;
	let li39;
	let t115;
	let t116;
	let ul11;
	let li40;
	let t117;
	let t118;
	let li41;
	let t119;
	let t120;
	let button3;
	let t121_value = (/*isArabic*/ ctx[0] ? "هارتس" : "Hearts") + "";
	let t121;
	let button3_aria_label_value;
	let t122;
	let main_class_value;
	let mounted;
	let dispose;
	let if_block = /*modalOpen*/ ctx[1] && /*selectedGame*/ ctx[2] && create_if_block(ctx);

	return {
		c() {
			main = element("main");
			div20 = element("div");
			header = element("header");
			h1 = element("h1");
			t0 = text(t0_value);
			t1 = space();
			p = element("p");
			t2 = text(t2_value);
			t3 = space();
			div0 = element("div");
			a = element("a");
			img = element("img");
			t4 = space();
			t5 = text(t5_value);
			t6 = space();
			button0 = element("button");
			t7 = text(t7_value);
			t8 = space();
			div19 = element("div");
			div6 = element("div");
			div5 = element("div");
			div1 = element("div");
			t9 = text("A fun card elimination game where the goal is to get rid of all your cards.");
			t10 = space();
			div2 = element("div");
			t11 = text("لعبة بطاقات ممتعة هدفها التخلص من جميع البطاقات الخاصة بك.");
			t12 = space();
			ul0 = element("ul");
			li0 = element("li");
			t13 = text("Each player gets 3 face-down cards, 3 face-up cards on top of those, and 3 cards in hand.");
			t14 = space();
			li1 = element("li");
			t15 = text("Players take turns placing cards of equal or higher value than the last card played.");
			t16 = space();
			li2 = element("li");
			t17 = text("Special cards: 2 clears the pile, 10 burns the pile, 7 forces next player to play below 7, 4 of a kind burns the pile.");
			t18 = space();
			li3 = element("li");
			t19 = text("If you can't play, you pick up the pile.");
			t20 = space();
			li4 = element("li");
			t21 = text("Last player with cards is the 'Shithead'.");
			t22 = space();
			ul1 = element("ul");
			li5 = element("li");
			t23 = text("يحصل كل لاعب على 3 بطاقات مقلوبة، و3 بطاقات مكشوفة فوقها، و3 بطاقات في اليد.");
			t24 = space();
			li6 = element("li");
			t25 = text("يتناوب اللاعبون في وضع البطاقات ذات قيمة مساوية أو أعلى من آخر بطاقة تم لعبها.");
			t26 = space();
			li7 = element("li");
			t27 = text("البطاقات الخاصة: 2 تمسح الكومة، 10 تحرق الكومة، 7 تجبر اللاعب التالي على اللعب تحت 7، 4 بطاقات متماثلة تحرق الكومة.");
			t28 = space();
			li8 = element("li");
			t29 = text("إذا لم تتمكن من اللعب، تأخذ الكومة.");
			t30 = space();
			li9 = element("li");
			t31 = text("آخر لاعب لديه بطاقات هو 'شيتهيد'.");
			t32 = space();
			div3 = element("div");
			t33 = text("3-6 players, standard deck of cards");
			t34 = space();
			div4 = element("div");
			t35 = text("3-6 لاعبين، مجموعة بطاقات قياسية");
			t36 = space();
			ul2 = element("ul");
			li10 = element("li");
			t37 = text("Be nice!");
			t38 = space();
			li11 = element("li");
			t39 = text("Have Fun!");
			t40 = space();
			ul3 = element("ul");
			li12 = element("li");
			t41 = text("كن لطيفا");
			t42 = space();
			li13 = element("li");
			t43 = text("استمتع");
			t44 = space();
			button1 = element("button");
			t45 = text(t45_value);
			t46 = space();
			div12 = element("div");
			div11 = element("div");
			div7 = element("div");
			t47 = text("A strategic card shedding game where players try to play all their cards around the 7s.");
			t48 = space();
			div8 = element("div");
			t49 = text("لعبة بطاقات استراتيجية يحاول فيها اللاعبون لعب جميع بطاقاتهم حول السبعات.");
			t50 = space();
			ul4 = element("ul");
			li14 = element("li");
			t51 = text("Deal all cards evenly to all players.");
			t52 = space();
			li15 = element("li");
			t53 = text("Play begins with the 7 of diamonds, or any 7 if that card has been dealt.");
			t54 = space();
			li16 = element("li");
			t55 = text("Players must play cards in sequence (6 or 8 next to 7, 5 or 9 next to 6 or 8, etc.) in the correct suit.");
			t56 = space();
			li17 = element("li");
			t57 = text("If a player cannot play, they pass their turn.");
			t58 = space();
			li18 = element("li");
			t59 = text("First player to get rid of all cards wins.");
			t60 = space();
			ul5 = element("ul");
			li19 = element("li");
			t61 = text("وزع جميع البطاقات بالتساوي على جميع اللاعبين.");
			t62 = space();
			li20 = element("li");
			t63 = text("تبدأ اللعبة بسبعة الماس، أو أي سبعة إذا تم توزيع تلك البطاقة.");
			t64 = space();
			li21 = element("li");
			t65 = text("يجب على اللاعبين لعب البطاقات بالتسلسل (6 أو 8 بجانب 7، 5 أو 9 بجانب 6 أو 8، إلخ) بالشكل الصحيح.");
			t66 = space();
			li22 = element("li");
			t67 = text("إذا لم يتمكن اللاعب من اللعب، يمرر دوره.");
			t68 = space();
			li23 = element("li");
			t69 = text("اللاعب الأول الذي يتخلص من جميع البطاقات يفوز.");
			t70 = space();
			div9 = element("div");
			t71 = text("2-8 players, standard deck of cards");
			t72 = space();
			div10 = element("div");
			t73 = text("2-8 لاعبين، مجموعة بطاقات قياسية");
			t74 = space();
			ul6 = element("ul");
			li24 = element("li");
			t75 = text("Shuffle well!");
			t76 = space();
			li25 = element("li");
			t77 = text("Have Fun!");
			t78 = space();
			ul7 = element("ul");
			li26 = element("li");
			t79 = text("قم بالخلط جيداً");
			t80 = space();
			li27 = element("li");
			t81 = text("استمتع");
			t82 = space();
			button2 = element("button");
			t83 = text(t83_value);
			t84 = space();
			div18 = element("div");
			div17 = element("div");
			div13 = element("div");
			t85 = text("A trick-taking card game where the goal is to avoid collecting hearts and the Queen of Spades.");
			t86 = space();
			div14 = element("div");
			t87 = text("لعبة بطاقات تعتمد على أخذ الأوراق، حيث الهدف هو تجنب جمع القلوب وملكة البستوني.");
			t88 = space();
			ul8 = element("ul");
			li28 = element("li");
			t89 = text("Each player gets 13 cards. Player with 2 of clubs leads first.");
			t90 = space();
			li29 = element("li");
			t91 = text("Players must follow suit if possible. If not, they can play any card.");
			t92 = space();
			li30 = element("li");
			t93 = text("Hearts cannot be led until they've been 'broken' (played on another suit).");
			t94 = space();
			li31 = element("li");
			t95 = text("Each heart is worth 1 point, Queen of Spades is worth 13 points.");
			t96 = space();
			li32 = element("li");
			t97 = text("Player with lowest score after agreed number of rounds wins.");
			t98 = space();
			ul9 = element("ul");
			li33 = element("li");
			t99 = text("يحصل كل لاعب على 13 بطاقة. اللاعب الذي لديه 2 شعار يبدأ أولاً.");
			t100 = space();
			li34 = element("li");
			t101 = text("يجب على اللاعبين اتباع نفس الشكل إن أمكن. إذا لم يكن ممكنًا، يمكنهم لعب أي بطاقة.");
			t102 = space();
			li35 = element("li");
			t103 = text("لا يمكن بدء القلوب حتى يتم 'كسرها' (لعبها على شكل آخر).");
			t104 = space();
			li36 = element("li");
			t105 = text("كل قلب يساوي 1 نقطة، ملكة البستوني تساوي 13 نقطة.");
			t106 = space();
			li37 = element("li");
			t107 = text("اللاعب صاحب أقل نقاط بعد عدد متفق عليه من الجولات يفوز.");
			t108 = space();
			div15 = element("div");
			t109 = text("4 players, standard deck of cards");
			t110 = space();
			div16 = element("div");
			t111 = text("4 لاعبين، مجموعة بطاقات قياسية");
			t112 = space();
			ul10 = element("ul");
			li38 = element("li");
			t113 = text("No shooting the moon!");
			t114 = space();
			li39 = element("li");
			t115 = text("Have Fun!");
			t116 = space();
			ul11 = element("ul");
			li40 = element("li");
			t117 = text("مفيش تصويب علي القمر");
			t118 = space();
			li41 = element("li");
			t119 = text("استمتع");
			t120 = space();
			button3 = element("button");
			t121 = text(t121_value);
			t122 = space();
			if (if_block) if_block.c();
			this.h();
		},
		l(nodes) {
			main = claim_element(nodes, "MAIN", { class: true });
			var main_nodes = children(main);
			div20 = claim_element(main_nodes, "DIV", { class: true });
			var div20_nodes = children(div20);
			header = claim_element(div20_nodes, "HEADER", { class: true });
			var header_nodes = children(header);
			h1 = claim_element(header_nodes, "H1", { class: true });
			var h1_nodes = children(h1);
			t0 = claim_text(h1_nodes, t0_value);
			h1_nodes.forEach(detach);
			t1 = claim_space(header_nodes);
			p = claim_element(header_nodes, "P", { class: true });
			var p_nodes = children(p);
			t2 = claim_text(p_nodes, t2_value);
			p_nodes.forEach(detach);
			t3 = claim_space(header_nodes);
			div0 = claim_element(header_nodes, "DIV", {});
			var div0_nodes = children(div0);
			a = claim_element(div0_nodes, "A", { href: true, class: true });
			var a_nodes = children(a);
			img = claim_element(a_nodes, "IMG", { src: true, alt: true, class: true });
			t4 = claim_space(a_nodes);
			t5 = claim_text(a_nodes, t5_value);
			a_nodes.forEach(detach);
			t6 = claim_space(div0_nodes);
			button0 = claim_element(div0_nodes, "BUTTON", { class: true, "aria-label": true });
			var button0_nodes = children(button0);
			t7 = claim_text(button0_nodes, t7_value);
			button0_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			header_nodes.forEach(detach);
			t8 = claim_space(div20_nodes);
			div19 = claim_element(div20_nodes, "DIV", { class: true });
			var div19_nodes = children(div19);

			div6 = claim_element(div19_nodes, "DIV", {
				class: true,
				"data-name": true,
				"data-name-ar": true
			});

			var div6_nodes = children(div6);
			div5 = claim_element(div6_nodes, "DIV", { style: true });
			var div5_nodes = children(div5);
			div1 = claim_element(div5_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			t9 = claim_text(div1_nodes, "A fun card elimination game where the goal is to get rid of all your cards.");
			div1_nodes.forEach(detach);
			t10 = claim_space(div5_nodes);
			div2 = claim_element(div5_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			t11 = claim_text(div2_nodes, "لعبة بطاقات ممتعة هدفها التخلص من جميع البطاقات الخاصة بك.");
			div2_nodes.forEach(detach);
			t12 = claim_space(div5_nodes);
			ul0 = claim_element(div5_nodes, "UL", { class: true });
			var ul0_nodes = children(ul0);
			li0 = claim_element(ul0_nodes, "LI", { class: true });
			var li0_nodes = children(li0);
			t13 = claim_text(li0_nodes, "Each player gets 3 face-down cards, 3 face-up cards on top of those, and 3 cards in hand.");
			li0_nodes.forEach(detach);
			t14 = claim_space(ul0_nodes);
			li1 = claim_element(ul0_nodes, "LI", { class: true });
			var li1_nodes = children(li1);
			t15 = claim_text(li1_nodes, "Players take turns placing cards of equal or higher value than the last card played.");
			li1_nodes.forEach(detach);
			t16 = claim_space(ul0_nodes);
			li2 = claim_element(ul0_nodes, "LI", { class: true });
			var li2_nodes = children(li2);
			t17 = claim_text(li2_nodes, "Special cards: 2 clears the pile, 10 burns the pile, 7 forces next player to play below 7, 4 of a kind burns the pile.");
			li2_nodes.forEach(detach);
			t18 = claim_space(ul0_nodes);
			li3 = claim_element(ul0_nodes, "LI", { class: true });
			var li3_nodes = children(li3);
			t19 = claim_text(li3_nodes, "If you can't play, you pick up the pile.");
			li3_nodes.forEach(detach);
			t20 = claim_space(ul0_nodes);
			li4 = claim_element(ul0_nodes, "LI", { class: true });
			var li4_nodes = children(li4);
			t21 = claim_text(li4_nodes, "Last player with cards is the 'Shithead'.");
			li4_nodes.forEach(detach);
			ul0_nodes.forEach(detach);
			t22 = claim_space(div5_nodes);
			ul1 = claim_element(div5_nodes, "UL", { class: true });
			var ul1_nodes = children(ul1);
			li5 = claim_element(ul1_nodes, "LI", { class: true });
			var li5_nodes = children(li5);
			t23 = claim_text(li5_nodes, "يحصل كل لاعب على 3 بطاقات مقلوبة، و3 بطاقات مكشوفة فوقها، و3 بطاقات في اليد.");
			li5_nodes.forEach(detach);
			t24 = claim_space(ul1_nodes);
			li6 = claim_element(ul1_nodes, "LI", { class: true });
			var li6_nodes = children(li6);
			t25 = claim_text(li6_nodes, "يتناوب اللاعبون في وضع البطاقات ذات قيمة مساوية أو أعلى من آخر بطاقة تم لعبها.");
			li6_nodes.forEach(detach);
			t26 = claim_space(ul1_nodes);
			li7 = claim_element(ul1_nodes, "LI", { class: true });
			var li7_nodes = children(li7);
			t27 = claim_text(li7_nodes, "البطاقات الخاصة: 2 تمسح الكومة، 10 تحرق الكومة، 7 تجبر اللاعب التالي على اللعب تحت 7، 4 بطاقات متماثلة تحرق الكومة.");
			li7_nodes.forEach(detach);
			t28 = claim_space(ul1_nodes);
			li8 = claim_element(ul1_nodes, "LI", { class: true });
			var li8_nodes = children(li8);
			t29 = claim_text(li8_nodes, "إذا لم تتمكن من اللعب، تأخذ الكومة.");
			li8_nodes.forEach(detach);
			t30 = claim_space(ul1_nodes);
			li9 = claim_element(ul1_nodes, "LI", { class: true });
			var li9_nodes = children(li9);
			t31 = claim_text(li9_nodes, "آخر لاعب لديه بطاقات هو 'شيتهيد'.");
			li9_nodes.forEach(detach);
			ul1_nodes.forEach(detach);
			t32 = claim_space(div5_nodes);
			div3 = claim_element(div5_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			t33 = claim_text(div3_nodes, "3-6 players, standard deck of cards");
			div3_nodes.forEach(detach);
			t34 = claim_space(div5_nodes);
			div4 = claim_element(div5_nodes, "DIV", { class: true });
			var div4_nodes = children(div4);
			t35 = claim_text(div4_nodes, "3-6 لاعبين، مجموعة بطاقات قياسية");
			div4_nodes.forEach(detach);
			t36 = claim_space(div5_nodes);
			ul2 = claim_element(div5_nodes, "UL", { class: true });
			var ul2_nodes = children(ul2);
			li10 = claim_element(ul2_nodes, "LI", { class: true });
			var li10_nodes = children(li10);
			t37 = claim_text(li10_nodes, "Be nice!");
			li10_nodes.forEach(detach);
			t38 = claim_space(ul2_nodes);
			li11 = claim_element(ul2_nodes, "LI", { class: true });
			var li11_nodes = children(li11);
			t39 = claim_text(li11_nodes, "Have Fun!");
			li11_nodes.forEach(detach);
			ul2_nodes.forEach(detach);
			t40 = claim_space(div5_nodes);
			ul3 = claim_element(div5_nodes, "UL", { class: true });
			var ul3_nodes = children(ul3);
			li12 = claim_element(ul3_nodes, "LI", { class: true });
			var li12_nodes = children(li12);
			t41 = claim_text(li12_nodes, "كن لطيفا");
			li12_nodes.forEach(detach);
			t42 = claim_space(ul3_nodes);
			li13 = claim_element(ul3_nodes, "LI", { class: true });
			var li13_nodes = children(li13);
			t43 = claim_text(li13_nodes, "استمتع");
			li13_nodes.forEach(detach);
			ul3_nodes.forEach(detach);
			div5_nodes.forEach(detach);
			t44 = claim_space(div6_nodes);
			button1 = claim_element(div6_nodes, "BUTTON", { class: true, "aria-label": true });
			var button1_nodes = children(button1);
			t45 = claim_text(button1_nodes, t45_value);
			button1_nodes.forEach(detach);
			div6_nodes.forEach(detach);
			t46 = claim_space(div19_nodes);

			div12 = claim_element(div19_nodes, "DIV", {
				class: true,
				"data-name": true,
				"data-name-ar": true
			});

			var div12_nodes = children(div12);
			div11 = claim_element(div12_nodes, "DIV", { style: true });
			var div11_nodes = children(div11);
			div7 = claim_element(div11_nodes, "DIV", { class: true });
			var div7_nodes = children(div7);
			t47 = claim_text(div7_nodes, "A strategic card shedding game where players try to play all their cards around the 7s.");
			div7_nodes.forEach(detach);
			t48 = claim_space(div11_nodes);
			div8 = claim_element(div11_nodes, "DIV", { class: true });
			var div8_nodes = children(div8);
			t49 = claim_text(div8_nodes, "لعبة بطاقات استراتيجية يحاول فيها اللاعبون لعب جميع بطاقاتهم حول السبعات.");
			div8_nodes.forEach(detach);
			t50 = claim_space(div11_nodes);
			ul4 = claim_element(div11_nodes, "UL", { class: true });
			var ul4_nodes = children(ul4);
			li14 = claim_element(ul4_nodes, "LI", { class: true });
			var li14_nodes = children(li14);
			t51 = claim_text(li14_nodes, "Deal all cards evenly to all players.");
			li14_nodes.forEach(detach);
			t52 = claim_space(ul4_nodes);
			li15 = claim_element(ul4_nodes, "LI", { class: true });
			var li15_nodes = children(li15);
			t53 = claim_text(li15_nodes, "Play begins with the 7 of diamonds, or any 7 if that card has been dealt.");
			li15_nodes.forEach(detach);
			t54 = claim_space(ul4_nodes);
			li16 = claim_element(ul4_nodes, "LI", { class: true });
			var li16_nodes = children(li16);
			t55 = claim_text(li16_nodes, "Players must play cards in sequence (6 or 8 next to 7, 5 or 9 next to 6 or 8, etc.) in the correct suit.");
			li16_nodes.forEach(detach);
			t56 = claim_space(ul4_nodes);
			li17 = claim_element(ul4_nodes, "LI", { class: true });
			var li17_nodes = children(li17);
			t57 = claim_text(li17_nodes, "If a player cannot play, they pass their turn.");
			li17_nodes.forEach(detach);
			t58 = claim_space(ul4_nodes);
			li18 = claim_element(ul4_nodes, "LI", { class: true });
			var li18_nodes = children(li18);
			t59 = claim_text(li18_nodes, "First player to get rid of all cards wins.");
			li18_nodes.forEach(detach);
			ul4_nodes.forEach(detach);
			t60 = claim_space(div11_nodes);
			ul5 = claim_element(div11_nodes, "UL", { class: true });
			var ul5_nodes = children(ul5);
			li19 = claim_element(ul5_nodes, "LI", { class: true });
			var li19_nodes = children(li19);
			t61 = claim_text(li19_nodes, "وزع جميع البطاقات بالتساوي على جميع اللاعبين.");
			li19_nodes.forEach(detach);
			t62 = claim_space(ul5_nodes);
			li20 = claim_element(ul5_nodes, "LI", { class: true });
			var li20_nodes = children(li20);
			t63 = claim_text(li20_nodes, "تبدأ اللعبة بسبعة الماس، أو أي سبعة إذا تم توزيع تلك البطاقة.");
			li20_nodes.forEach(detach);
			t64 = claim_space(ul5_nodes);
			li21 = claim_element(ul5_nodes, "LI", { class: true });
			var li21_nodes = children(li21);
			t65 = claim_text(li21_nodes, "يجب على اللاعبين لعب البطاقات بالتسلسل (6 أو 8 بجانب 7، 5 أو 9 بجانب 6 أو 8، إلخ) بالشكل الصحيح.");
			li21_nodes.forEach(detach);
			t66 = claim_space(ul5_nodes);
			li22 = claim_element(ul5_nodes, "LI", { class: true });
			var li22_nodes = children(li22);
			t67 = claim_text(li22_nodes, "إذا لم يتمكن اللاعب من اللعب، يمرر دوره.");
			li22_nodes.forEach(detach);
			t68 = claim_space(ul5_nodes);
			li23 = claim_element(ul5_nodes, "LI", { class: true });
			var li23_nodes = children(li23);
			t69 = claim_text(li23_nodes, "اللاعب الأول الذي يتخلص من جميع البطاقات يفوز.");
			li23_nodes.forEach(detach);
			ul5_nodes.forEach(detach);
			t70 = claim_space(div11_nodes);
			div9 = claim_element(div11_nodes, "DIV", { class: true });
			var div9_nodes = children(div9);
			t71 = claim_text(div9_nodes, "2-8 players, standard deck of cards");
			div9_nodes.forEach(detach);
			t72 = claim_space(div11_nodes);
			div10 = claim_element(div11_nodes, "DIV", { class: true });
			var div10_nodes = children(div10);
			t73 = claim_text(div10_nodes, "2-8 لاعبين، مجموعة بطاقات قياسية");
			div10_nodes.forEach(detach);
			t74 = claim_space(div11_nodes);
			ul6 = claim_element(div11_nodes, "UL", { class: true });
			var ul6_nodes = children(ul6);
			li24 = claim_element(ul6_nodes, "LI", { class: true });
			var li24_nodes = children(li24);
			t75 = claim_text(li24_nodes, "Shuffle well!");
			li24_nodes.forEach(detach);
			t76 = claim_space(ul6_nodes);
			li25 = claim_element(ul6_nodes, "LI", { class: true });
			var li25_nodes = children(li25);
			t77 = claim_text(li25_nodes, "Have Fun!");
			li25_nodes.forEach(detach);
			ul6_nodes.forEach(detach);
			t78 = claim_space(div11_nodes);
			ul7 = claim_element(div11_nodes, "UL", { class: true });
			var ul7_nodes = children(ul7);
			li26 = claim_element(ul7_nodes, "LI", { class: true });
			var li26_nodes = children(li26);
			t79 = claim_text(li26_nodes, "قم بالخلط جيداً");
			li26_nodes.forEach(detach);
			t80 = claim_space(ul7_nodes);
			li27 = claim_element(ul7_nodes, "LI", { class: true });
			var li27_nodes = children(li27);
			t81 = claim_text(li27_nodes, "استمتع");
			li27_nodes.forEach(detach);
			ul7_nodes.forEach(detach);
			div11_nodes.forEach(detach);
			t82 = claim_space(div12_nodes);
			button2 = claim_element(div12_nodes, "BUTTON", { class: true, "aria-label": true });
			var button2_nodes = children(button2);
			t83 = claim_text(button2_nodes, t83_value);
			button2_nodes.forEach(detach);
			div12_nodes.forEach(detach);
			t84 = claim_space(div19_nodes);

			div18 = claim_element(div19_nodes, "DIV", {
				class: true,
				"data-name": true,
				"data-name-ar": true
			});

			var div18_nodes = children(div18);
			div17 = claim_element(div18_nodes, "DIV", { style: true });
			var div17_nodes = children(div17);
			div13 = claim_element(div17_nodes, "DIV", { class: true });
			var div13_nodes = children(div13);
			t85 = claim_text(div13_nodes, "A trick-taking card game where the goal is to avoid collecting hearts and the Queen of Spades.");
			div13_nodes.forEach(detach);
			t86 = claim_space(div17_nodes);
			div14 = claim_element(div17_nodes, "DIV", { class: true });
			var div14_nodes = children(div14);
			t87 = claim_text(div14_nodes, "لعبة بطاقات تعتمد على أخذ الأوراق، حيث الهدف هو تجنب جمع القلوب وملكة البستوني.");
			div14_nodes.forEach(detach);
			t88 = claim_space(div17_nodes);
			ul8 = claim_element(div17_nodes, "UL", { class: true });
			var ul8_nodes = children(ul8);
			li28 = claim_element(ul8_nodes, "LI", { class: true });
			var li28_nodes = children(li28);
			t89 = claim_text(li28_nodes, "Each player gets 13 cards. Player with 2 of clubs leads first.");
			li28_nodes.forEach(detach);
			t90 = claim_space(ul8_nodes);
			li29 = claim_element(ul8_nodes, "LI", { class: true });
			var li29_nodes = children(li29);
			t91 = claim_text(li29_nodes, "Players must follow suit if possible. If not, they can play any card.");
			li29_nodes.forEach(detach);
			t92 = claim_space(ul8_nodes);
			li30 = claim_element(ul8_nodes, "LI", { class: true });
			var li30_nodes = children(li30);
			t93 = claim_text(li30_nodes, "Hearts cannot be led until they've been 'broken' (played on another suit).");
			li30_nodes.forEach(detach);
			t94 = claim_space(ul8_nodes);
			li31 = claim_element(ul8_nodes, "LI", { class: true });
			var li31_nodes = children(li31);
			t95 = claim_text(li31_nodes, "Each heart is worth 1 point, Queen of Spades is worth 13 points.");
			li31_nodes.forEach(detach);
			t96 = claim_space(ul8_nodes);
			li32 = claim_element(ul8_nodes, "LI", { class: true });
			var li32_nodes = children(li32);
			t97 = claim_text(li32_nodes, "Player with lowest score after agreed number of rounds wins.");
			li32_nodes.forEach(detach);
			ul8_nodes.forEach(detach);
			t98 = claim_space(div17_nodes);
			ul9 = claim_element(div17_nodes, "UL", { class: true });
			var ul9_nodes = children(ul9);
			li33 = claim_element(ul9_nodes, "LI", { class: true });
			var li33_nodes = children(li33);
			t99 = claim_text(li33_nodes, "يحصل كل لاعب على 13 بطاقة. اللاعب الذي لديه 2 شعار يبدأ أولاً.");
			li33_nodes.forEach(detach);
			t100 = claim_space(ul9_nodes);
			li34 = claim_element(ul9_nodes, "LI", { class: true });
			var li34_nodes = children(li34);
			t101 = claim_text(li34_nodes, "يجب على اللاعبين اتباع نفس الشكل إن أمكن. إذا لم يكن ممكنًا، يمكنهم لعب أي بطاقة.");
			li34_nodes.forEach(detach);
			t102 = claim_space(ul9_nodes);
			li35 = claim_element(ul9_nodes, "LI", { class: true });
			var li35_nodes = children(li35);
			t103 = claim_text(li35_nodes, "لا يمكن بدء القلوب حتى يتم 'كسرها' (لعبها على شكل آخر).");
			li35_nodes.forEach(detach);
			t104 = claim_space(ul9_nodes);
			li36 = claim_element(ul9_nodes, "LI", { class: true });
			var li36_nodes = children(li36);
			t105 = claim_text(li36_nodes, "كل قلب يساوي 1 نقطة، ملكة البستوني تساوي 13 نقطة.");
			li36_nodes.forEach(detach);
			t106 = claim_space(ul9_nodes);
			li37 = claim_element(ul9_nodes, "LI", { class: true });
			var li37_nodes = children(li37);
			t107 = claim_text(li37_nodes, "اللاعب صاحب أقل نقاط بعد عدد متفق عليه من الجولات يفوز.");
			li37_nodes.forEach(detach);
			ul9_nodes.forEach(detach);
			t108 = claim_space(div17_nodes);
			div15 = claim_element(div17_nodes, "DIV", { class: true });
			var div15_nodes = children(div15);
			t109 = claim_text(div15_nodes, "4 players, standard deck of cards");
			div15_nodes.forEach(detach);
			t110 = claim_space(div17_nodes);
			div16 = claim_element(div17_nodes, "DIV", { class: true });
			var div16_nodes = children(div16);
			t111 = claim_text(div16_nodes, "4 لاعبين، مجموعة بطاقات قياسية");
			div16_nodes.forEach(detach);
			t112 = claim_space(div17_nodes);
			ul10 = claim_element(div17_nodes, "UL", { class: true });
			var ul10_nodes = children(ul10);
			li38 = claim_element(ul10_nodes, "LI", { class: true });
			var li38_nodes = children(li38);
			t113 = claim_text(li38_nodes, "No shooting the moon!");
			li38_nodes.forEach(detach);
			t114 = claim_space(ul10_nodes);
			li39 = claim_element(ul10_nodes, "LI", { class: true });
			var li39_nodes = children(li39);
			t115 = claim_text(li39_nodes, "Have Fun!");
			li39_nodes.forEach(detach);
			ul10_nodes.forEach(detach);
			t116 = claim_space(div17_nodes);
			ul11 = claim_element(div17_nodes, "UL", { class: true });
			var ul11_nodes = children(ul11);
			li40 = claim_element(ul11_nodes, "LI", { class: true });
			var li40_nodes = children(li40);
			t117 = claim_text(li40_nodes, "مفيش تصويب علي القمر");
			li40_nodes.forEach(detach);
			t118 = claim_space(ul11_nodes);
			li41 = claim_element(ul11_nodes, "LI", { class: true });
			var li41_nodes = children(li41);
			t119 = claim_text(li41_nodes, "استمتع");
			li41_nodes.forEach(detach);
			ul11_nodes.forEach(detach);
			div17_nodes.forEach(detach);
			t120 = claim_space(div18_nodes);
			button3 = claim_element(div18_nodes, "BUTTON", { class: true, "aria-label": true });
			var button3_nodes = children(button3);
			t121 = claim_text(button3_nodes, t121_value);
			button3_nodes.forEach(detach);
			div18_nodes.forEach(detach);
			div19_nodes.forEach(detach);
			t122 = claim_space(div20_nodes);
			if (if_block) if_block.l(div20_nodes);
			div20_nodes.forEach(detach);
			main_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h1, "class", "svelte-ll3htz");
			attr(p, "class", "game-night-description svelte-ll3htz");
			if (!src_url_equal(img.src, img_src_value = "whatsapp-icon.png")) attr(img, "src", img_src_value);
			attr(img, "alt", "WhatsApp Icon");
			attr(img, "class", "whatsapp-icon svelte-ll3htz");
			attr(a, "href", "https://chat.whatsapp.com/YOUR_ACTUAL_GROUP_LINK");
			attr(a, "class", "whatsapp-button svelte-ll3htz");
			attr(button0, "class", "language-toggle svelte-ll3htz");

			attr(button0, "aria-label", button0_aria_label_value = /*isArabic*/ ctx[0]
			? "Switch to English"
			: "Switch to Arabic");

			attr(header, "class", "svelte-ll3htz");
			attr(div1, "class", "game-description-en");
			attr(div2, "class", "game-description-ar");
			attr(li0, "class", "svelte-ll3htz");
			attr(li1, "class", "svelte-ll3htz");
			attr(li2, "class", "svelte-ll3htz");
			attr(li3, "class", "svelte-ll3htz");
			attr(li4, "class", "svelte-ll3htz");
			attr(ul0, "class", "game-howtoplay-en svelte-ll3htz");
			attr(li5, "class", "svelte-ll3htz");
			attr(li6, "class", "svelte-ll3htz");
			attr(li7, "class", "svelte-ll3htz");
			attr(li8, "class", "svelte-ll3htz");
			attr(li9, "class", "svelte-ll3htz");
			attr(ul1, "class", "game-howtoplay-ar svelte-ll3htz");
			attr(div3, "class", "game-requirements-en");
			attr(div4, "class", "game-requirements-ar");
			attr(li10, "class", "svelte-ll3htz");
			attr(li11, "class", "svelte-ll3htz");
			attr(ul2, "class", "game-rules-en svelte-ll3htz");
			attr(li12, "class", "svelte-ll3htz");
			attr(li13, "class", "svelte-ll3htz");
			attr(ul3, "class", "game-rules-ar svelte-ll3htz");
			set_style(div5, "display", "none");
			attr(button1, "class", "game-button svelte-ll3htz");

			attr(button1, "aria-label", button1_aria_label_value = /*isArabic*/ ctx[0]
			? "عرض تفاصيل لعبة شيتهيد"
			: "View Shithead game details");

			attr(div6, "class", "game-data");
			attr(div6, "data-name", "Shithead");
			attr(div6, "data-name-ar", "شيتهيد");
			attr(div7, "class", "game-description-en");
			attr(div8, "class", "game-description-ar");
			attr(li14, "class", "svelte-ll3htz");
			attr(li15, "class", "svelte-ll3htz");
			attr(li16, "class", "svelte-ll3htz");
			attr(li17, "class", "svelte-ll3htz");
			attr(li18, "class", "svelte-ll3htz");
			attr(ul4, "class", "game-howtoplay-en svelte-ll3htz");
			attr(li19, "class", "svelte-ll3htz");
			attr(li20, "class", "svelte-ll3htz");
			attr(li21, "class", "svelte-ll3htz");
			attr(li22, "class", "svelte-ll3htz");
			attr(li23, "class", "svelte-ll3htz");
			attr(ul5, "class", "game-howtoplay-ar svelte-ll3htz");
			attr(div9, "class", "game-requirements-en");
			attr(div10, "class", "game-requirements-ar");
			attr(li24, "class", "svelte-ll3htz");
			attr(li25, "class", "svelte-ll3htz");
			attr(ul6, "class", "game-rules-en svelte-ll3htz");
			attr(li26, "class", "svelte-ll3htz");
			attr(li27, "class", "svelte-ll3htz");
			attr(ul7, "class", "game-rules-ar svelte-ll3htz");
			set_style(div11, "display", "none");
			attr(button2, "class", "game-button svelte-ll3htz");

			attr(button2, "aria-label", button2_aria_label_value = /*isArabic*/ ctx[0]
			? "عرض تفاصيل لعبة سفنز"
			: "View Sevens game details");

			attr(div12, "class", "game-data");
			attr(div12, "data-name", "Sevens");
			attr(div12, "data-name-ar", "سفنز");
			attr(div13, "class", "game-description-en");
			attr(div14, "class", "game-description-ar");
			attr(li28, "class", "svelte-ll3htz");
			attr(li29, "class", "svelte-ll3htz");
			attr(li30, "class", "svelte-ll3htz");
			attr(li31, "class", "svelte-ll3htz");
			attr(li32, "class", "svelte-ll3htz");
			attr(ul8, "class", "game-howtoplay-en svelte-ll3htz");
			attr(li33, "class", "svelte-ll3htz");
			attr(li34, "class", "svelte-ll3htz");
			attr(li35, "class", "svelte-ll3htz");
			attr(li36, "class", "svelte-ll3htz");
			attr(li37, "class", "svelte-ll3htz");
			attr(ul9, "class", "game-howtoplay-ar svelte-ll3htz");
			attr(div15, "class", "game-requirements-en");
			attr(div16, "class", "game-requirements-ar");
			attr(li38, "class", "svelte-ll3htz");
			attr(li39, "class", "svelte-ll3htz");
			attr(ul10, "class", "game-rules-en svelte-ll3htz");
			attr(li40, "class", "svelte-ll3htz");
			attr(li41, "class", "svelte-ll3htz");
			attr(ul11, "class", "game-rules-ar svelte-ll3htz");
			set_style(div17, "display", "none");
			attr(button3, "class", "game-button svelte-ll3htz");

			attr(button3, "aria-label", button3_aria_label_value = /*isArabic*/ ctx[0]
			? "عرض تفاصيل لعبة هارتس"
			: "View Hearts game details");

			attr(div18, "class", "game-data");
			attr(div18, "data-name", "Hearts");
			attr(div18, "data-name-ar", "هارتس");
			attr(div19, "class", "games-container svelte-ll3htz");
			attr(div20, "class", "container svelte-ll3htz");
			attr(main, "class", main_class_value = "" + (null_to_empty(/*isArabic*/ ctx[0] ? 'rtl' : 'ltr') + " svelte-ll3htz"));
		},
		m(target, anchor) {
			insert_hydration(target, main, anchor);
			append_hydration(main, div20);
			append_hydration(div20, header);
			append_hydration(header, h1);
			append_hydration(h1, t0);
			append_hydration(header, t1);
			append_hydration(header, p);
			append_hydration(p, t2);
			append_hydration(header, t3);
			append_hydration(header, div0);
			append_hydration(div0, a);
			append_hydration(a, img);
			append_hydration(a, t4);
			append_hydration(a, t5);
			append_hydration(div0, t6);
			append_hydration(div0, button0);
			append_hydration(button0, t7);
			append_hydration(div20, t8);
			append_hydration(div20, div19);
			append_hydration(div19, div6);
			append_hydration(div6, div5);
			append_hydration(div5, div1);
			append_hydration(div1, t9);
			append_hydration(div5, t10);
			append_hydration(div5, div2);
			append_hydration(div2, t11);
			append_hydration(div5, t12);
			append_hydration(div5, ul0);
			append_hydration(ul0, li0);
			append_hydration(li0, t13);
			append_hydration(ul0, t14);
			append_hydration(ul0, li1);
			append_hydration(li1, t15);
			append_hydration(ul0, t16);
			append_hydration(ul0, li2);
			append_hydration(li2, t17);
			append_hydration(ul0, t18);
			append_hydration(ul0, li3);
			append_hydration(li3, t19);
			append_hydration(ul0, t20);
			append_hydration(ul0, li4);
			append_hydration(li4, t21);
			append_hydration(div5, t22);
			append_hydration(div5, ul1);
			append_hydration(ul1, li5);
			append_hydration(li5, t23);
			append_hydration(ul1, t24);
			append_hydration(ul1, li6);
			append_hydration(li6, t25);
			append_hydration(ul1, t26);
			append_hydration(ul1, li7);
			append_hydration(li7, t27);
			append_hydration(ul1, t28);
			append_hydration(ul1, li8);
			append_hydration(li8, t29);
			append_hydration(ul1, t30);
			append_hydration(ul1, li9);
			append_hydration(li9, t31);
			append_hydration(div5, t32);
			append_hydration(div5, div3);
			append_hydration(div3, t33);
			append_hydration(div5, t34);
			append_hydration(div5, div4);
			append_hydration(div4, t35);
			append_hydration(div5, t36);
			append_hydration(div5, ul2);
			append_hydration(ul2, li10);
			append_hydration(li10, t37);
			append_hydration(ul2, t38);
			append_hydration(ul2, li11);
			append_hydration(li11, t39);
			append_hydration(div5, t40);
			append_hydration(div5, ul3);
			append_hydration(ul3, li12);
			append_hydration(li12, t41);
			append_hydration(ul3, t42);
			append_hydration(ul3, li13);
			append_hydration(li13, t43);
			append_hydration(div6, t44);
			append_hydration(div6, button1);
			append_hydration(button1, t45);
			append_hydration(div19, t46);
			append_hydration(div19, div12);
			append_hydration(div12, div11);
			append_hydration(div11, div7);
			append_hydration(div7, t47);
			append_hydration(div11, t48);
			append_hydration(div11, div8);
			append_hydration(div8, t49);
			append_hydration(div11, t50);
			append_hydration(div11, ul4);
			append_hydration(ul4, li14);
			append_hydration(li14, t51);
			append_hydration(ul4, t52);
			append_hydration(ul4, li15);
			append_hydration(li15, t53);
			append_hydration(ul4, t54);
			append_hydration(ul4, li16);
			append_hydration(li16, t55);
			append_hydration(ul4, t56);
			append_hydration(ul4, li17);
			append_hydration(li17, t57);
			append_hydration(ul4, t58);
			append_hydration(ul4, li18);
			append_hydration(li18, t59);
			append_hydration(div11, t60);
			append_hydration(div11, ul5);
			append_hydration(ul5, li19);
			append_hydration(li19, t61);
			append_hydration(ul5, t62);
			append_hydration(ul5, li20);
			append_hydration(li20, t63);
			append_hydration(ul5, t64);
			append_hydration(ul5, li21);
			append_hydration(li21, t65);
			append_hydration(ul5, t66);
			append_hydration(ul5, li22);
			append_hydration(li22, t67);
			append_hydration(ul5, t68);
			append_hydration(ul5, li23);
			append_hydration(li23, t69);
			append_hydration(div11, t70);
			append_hydration(div11, div9);
			append_hydration(div9, t71);
			append_hydration(div11, t72);
			append_hydration(div11, div10);
			append_hydration(div10, t73);
			append_hydration(div11, t74);
			append_hydration(div11, ul6);
			append_hydration(ul6, li24);
			append_hydration(li24, t75);
			append_hydration(ul6, t76);
			append_hydration(ul6, li25);
			append_hydration(li25, t77);
			append_hydration(div11, t78);
			append_hydration(div11, ul7);
			append_hydration(ul7, li26);
			append_hydration(li26, t79);
			append_hydration(ul7, t80);
			append_hydration(ul7, li27);
			append_hydration(li27, t81);
			append_hydration(div12, t82);
			append_hydration(div12, button2);
			append_hydration(button2, t83);
			append_hydration(div19, t84);
			append_hydration(div19, div18);
			append_hydration(div18, div17);
			append_hydration(div17, div13);
			append_hydration(div13, t85);
			append_hydration(div17, t86);
			append_hydration(div17, div14);
			append_hydration(div14, t87);
			append_hydration(div17, t88);
			append_hydration(div17, ul8);
			append_hydration(ul8, li28);
			append_hydration(li28, t89);
			append_hydration(ul8, t90);
			append_hydration(ul8, li29);
			append_hydration(li29, t91);
			append_hydration(ul8, t92);
			append_hydration(ul8, li30);
			append_hydration(li30, t93);
			append_hydration(ul8, t94);
			append_hydration(ul8, li31);
			append_hydration(li31, t95);
			append_hydration(ul8, t96);
			append_hydration(ul8, li32);
			append_hydration(li32, t97);
			append_hydration(div17, t98);
			append_hydration(div17, ul9);
			append_hydration(ul9, li33);
			append_hydration(li33, t99);
			append_hydration(ul9, t100);
			append_hydration(ul9, li34);
			append_hydration(li34, t101);
			append_hydration(ul9, t102);
			append_hydration(ul9, li35);
			append_hydration(li35, t103);
			append_hydration(ul9, t104);
			append_hydration(ul9, li36);
			append_hydration(li36, t105);
			append_hydration(ul9, t106);
			append_hydration(ul9, li37);
			append_hydration(li37, t107);
			append_hydration(div17, t108);
			append_hydration(div17, div15);
			append_hydration(div15, t109);
			append_hydration(div17, t110);
			append_hydration(div17, div16);
			append_hydration(div16, t111);
			append_hydration(div17, t112);
			append_hydration(div17, ul10);
			append_hydration(ul10, li38);
			append_hydration(li38, t113);
			append_hydration(ul10, t114);
			append_hydration(ul10, li39);
			append_hydration(li39, t115);
			append_hydration(div17, t116);
			append_hydration(div17, ul11);
			append_hydration(ul11, li40);
			append_hydration(li40, t117);
			append_hydration(ul11, t118);
			append_hydration(ul11, li41);
			append_hydration(li41, t119);
			append_hydration(div18, t120);
			append_hydration(div18, button3);
			append_hydration(button3, t121);
			append_hydration(div20, t122);
			if (if_block) if_block.m(div20, null);

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*toggleLanguage*/ ctx[5]),
					listen(button0, "keydown", /*handleToggleKeydown*/ ctx[7]),
					listen(button1, "click", /*click_handler*/ ctx[12]),
					listen(button1, "keydown", /*keydown_handler*/ ctx[13]),
					listen(button2, "click", /*click_handler_1*/ ctx[14]),
					listen(button2, "keydown", /*keydown_handler_1*/ ctx[15]),
					listen(button3, "click", /*click_handler_2*/ ctx[16]),
					listen(button3, "keydown", /*keydown_handler_2*/ ctx[17])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*isArabic*/ 1 && t0_value !== (t0_value = (/*isArabic*/ ctx[0] ? 'ليلة الألعاب' : 'Game Night') + "")) set_data(t0, t0_value);

			if (dirty & /*isArabic*/ 1 && t2_value !== (t2_value = (/*isArabic*/ ctx[0]
			? 'مرة أو مرتين حسب جدول فعاليات باب. التسجيل عبر مجموعة الواتساب ضروري للحضور.'
			: 'Twice or once depends on Bab\'s activity schedule. Registration through the WhatsApp group is a must to attend.') + "")) set_data(t2, t2_value);

			if (dirty & /*isArabic*/ 1 && t5_value !== (t5_value = (/*isArabic*/ ctx[0]
			? 'مجموعة الواتساب'
			: 'WhatsApp Group') + "")) set_data(t5, t5_value);

			if (dirty & /*isArabic*/ 1 && t7_value !== (t7_value = (/*isArabic*/ ctx[0] ? 'English' : 'العربية') + "")) set_data(t7, t7_value);

			if (dirty & /*isArabic*/ 1 && button0_aria_label_value !== (button0_aria_label_value = /*isArabic*/ ctx[0]
			? "Switch to English"
			: "Switch to Arabic")) {
				attr(button0, "aria-label", button0_aria_label_value);
			}

			if (dirty & /*isArabic*/ 1 && t45_value !== (t45_value = (/*isArabic*/ ctx[0] ? "شيتهيد" : "Shithead") + "")) set_data(t45, t45_value);

			if (dirty & /*isArabic*/ 1 && button1_aria_label_value !== (button1_aria_label_value = /*isArabic*/ ctx[0]
			? "عرض تفاصيل لعبة شيتهيد"
			: "View Shithead game details")) {
				attr(button1, "aria-label", button1_aria_label_value);
			}

			if (dirty & /*isArabic*/ 1 && t83_value !== (t83_value = (/*isArabic*/ ctx[0] ? "سفنز" : "Sevens") + "")) set_data(t83, t83_value);

			if (dirty & /*isArabic*/ 1 && button2_aria_label_value !== (button2_aria_label_value = /*isArabic*/ ctx[0]
			? "عرض تفاصيل لعبة سفنز"
			: "View Sevens game details")) {
				attr(button2, "aria-label", button2_aria_label_value);
			}

			if (dirty & /*isArabic*/ 1 && t121_value !== (t121_value = (/*isArabic*/ ctx[0] ? "هارتس" : "Hearts") + "")) set_data(t121, t121_value);

			if (dirty & /*isArabic*/ 1 && button3_aria_label_value !== (button3_aria_label_value = /*isArabic*/ ctx[0]
			? "عرض تفاصيل لعبة هارتس"
			: "View Hearts game details")) {
				attr(button3, "aria-label", button3_aria_label_value);
			}

			if (/*modalOpen*/ ctx[1] && /*selectedGame*/ ctx[2]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block(ctx);
					if_block.c();
					if_block.m(div20, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}

			if (dirty & /*isArabic*/ 1 && main_class_value !== (main_class_value = "" + (null_to_empty(/*isArabic*/ ctx[0] ? 'rtl' : 'ltr') + " svelte-ll3htz"))) {
				attr(main, "class", main_class_value);
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(main);
			if (if_block) if_block.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;
	let isArabic = false;
	let modalOpen = false;
	let selectedGame = null;

	function openModal(gameElement) {
		$$invalidate(2, selectedGame = {
			name: gameElement.getAttribute('data-name'),
			nameAr: gameElement.getAttribute('data-name-ar'),
			description: gameElement.querySelector('.game-description-en').textContent,
			descriptionAr: gameElement.querySelector('.game-description-ar').textContent,
			howToPlayEn: Array.from(gameElement.querySelector('.game-howtoplay-en').querySelectorAll('li')).map(li => li.textContent),
			howToPlayAr: Array.from(gameElement.querySelector('.game-howtoplay-ar').querySelectorAll('li')).map(li => li.textContent),
			requirements: gameElement.querySelector('.game-requirements-en').textContent,
			requirementsAr: gameElement.querySelector('.game-requirements-ar').textContent,
			rulesEn: Array.from(gameElement.querySelector('.game-rules-en').querySelectorAll('li')).map(li => li.textContent),
			rulesAr: Array.from(gameElement.querySelector('.game-rules-ar').querySelectorAll('li')).map(li => li.textContent)
		});

		$$invalidate(1, modalOpen = true);

		setTimeout(
			() => {
				document.querySelector('.close-button').focus();
			},
			100
		);
	}

	function closeModal() {
		$$invalidate(1, modalOpen = false);

		setTimeout(
			() => {
				document.activeElement.focus();
			},
			100
		);
	}

	function toggleLanguage() {
		$$invalidate(0, isArabic = !isArabic);
	}

	function handleButtonKeydown(event, gameElement) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openModal(gameElement);
		}
	}

	function handleToggleKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleLanguage();
		}
	}

	function handleCloseKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			closeModal();
		}
	}

	function handleOutsideClick(event) {
		if (event.target.classList.contains('modal-overlay')) {
			closeModal();
		}
	}

	function handleModalKeydown(event) {
		if (event.key === 'Escape' && modalOpen) {
			closeModal();
		}
	}

	const click_handler = e => openModal(e.target.closest('.game-data'));
	const keydown_handler = e => handleButtonKeydown(e, e.target.closest('.game-data'));
	const click_handler_1 = e => openModal(e.target.closest('.game-data'));
	const keydown_handler_1 = e => handleButtonKeydown(e, e.target.closest('.game-data'));
	const click_handler_2 = e => openModal(e.target.closest('.game-data'));
	const keydown_handler_2 = e => handleButtonKeydown(e, e.target.closest('.game-data'));

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(11, props = $$props.props);
	};

	return [
		isArabic,
		modalOpen,
		selectedGame,
		openModal,
		closeModal,
		toggleLanguage,
		handleButtonKeydown,
		handleToggleKeydown,
		handleCloseKeydown,
		handleOutsideClick,
		handleModalKeydown,
		props,
		click_handler,
		keydown_handler,
		click_handler_1,
		keydown_handler_1,
		click_handler_2,
		keydown_handler_2
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { props: 11 });
	}
}

export { Component as default };
