/**
 * Splay Tree Search controller.
 *
 * This controller uses the pure `SplayTree` data-structure (no visual code)
 * to perform a splay on the accessed key and then updates the visualiser
 * to reflect the new tree (accessed node moved to root).
 */

import SplayTree from './splaytree';
import { addSplayRotationChunks, getSplayTreePath } from './InsertionSharedCode';

export default {
    /**
         * For the search algorithm, we use the tree that is created in
         * the insertion algorithm to initialise the visualiser
         * @param {object} visualiser
         */
    initVisualisers({ visualiser }) {
        // clear existing trace, if any
        visualiser.graph.instance.clear();
        return {
            graph: {
                instance: visualiser.graph.instance,
                order: 0,
            },
        };
    },

    /**
     * We use the tree that is created in the insertion algorithm to search
     * @param {object} chunker
     * @param {object} visualiser
     * @param {number} target
     */
    run(chunker, { visualiser, target }) {
        // get whole (flat) tree and root id from the visualiser
        const flatTree = visualiser.graph.instance.getTree();
        const rootId = visualiser.graph.instance.getRoot();

        // helper: build a nested SplayTree Node structure from the flat tree
        function buildNested(id) {
            if (id === undefined || id === null) return null;
            const node = SplayTree.newNode(id);
            const entry = flatTree[id] || {};
            if (entry.left) node.left = buildNested(entry.left);
            if (entry.right) node.right = buildNested(entry.right);
            return node;
        }

        const nestedRoot = buildNested(rootId);
        const searchPath = getSplayTreePath(nestedRoot, target);

        searchPath.forEach((nodeKey, index) => {
            const parentKey = index === 0 ? null : searchPath[index - 1];

            chunker.add(
                'switchPath',
                (vis, currentKey, previousKey, searchedKey) => {
                    const graph = vis.graph;
                    graph.setFunctionName(`Search: ${searchedKey}`);

                    if (previousKey !== null) {
                        graph.setNodeColor(previousKey, '#A9D6FF');
                        graph.setEdgeColor(previousKey, currentKey, '#A9D6FF');
                    }
                    graph.setNodeColor(currentKey, '#A9D6FF');
                },
                [nodeKey, parentKey, target],
                1,
            );
        });

        chunker.add('Splay_Search(t, k)', (vis) => {
            vis.graph.setZoom(0.55);
            vis.graph.popAllRectStack();
            vis.graph.setFunctionInsertText(`(t, ${target})`);
            vis.graph.setFunctionName('Splay_Search');
        }, [rootId]);

        const algorithmEvents = [];
        // perform the splay (this moves the accessed node, or the last accessed
        // node while searching, to the root)
        const newRoot = SplayTree.search(nestedRoot, target, event => {
            if (event.type === 'rotation') {
                algorithmEvents.push(event);
            }
        });

        addSplayRotationChunks(chunker, algorithmEvents, 'search', rootId);

        // convert nested tree back into flat edges on the visualiser
        const g = visualiser.graph.instance;
        // remove all existing edges
        const oldEdges = g.edges ? [...g.edges] : [];
        oldEdges.forEach(e => g.removeEdge(e.source, e.target));

        // traverse nested tree and add edges
        function addEdges(node) {
            if (!node) return;
            if (node.left) {
                g.addEdge(node.key, node.left.key);
                addEdges(node.left);
            }
            if (node.right) {
                g.addEdge(node.key, node.right.key);
                addEdges(node.right);
            }
        }
        if (newRoot) addEdges(newRoot);

        // layout the tree with the new root
        if (newRoot) {
            g.layoutTree(newRoot.key);
            g.directed(true);
            g.layout();
        }

        // set message and return status based on whether target reached root
        if (newRoot && newRoot.key === target) {
            chunker.add('return t', (vis) => {
                if (vis.graph.clearTID) vis.graph.clearTID();
                vis.graph.setText('Key found');
            });
            return 'success';
        }

        chunker.add('return NotFound', (vis) => {
            if (vis.graph.clearTID) vis.graph.clearTID();
            vis.graph.setText('Key not found');
        });
        return 'fail';
    },
};
