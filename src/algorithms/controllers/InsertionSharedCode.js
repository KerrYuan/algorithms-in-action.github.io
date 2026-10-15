/**
 * This file contains shared insertion code for both BST and AVL trees
 * and also recursive BST search!
 *
 * May soon contain splay tree code - currently just hacked so we can
 * display splay tree pseudocode XXX FIX this. Best refactor code if
 * possible to avoid duplication of code (we want the animations to be
 * as similar as possible). Other cleaning up might be possible also -
 * some is getter rather complex. Might be best to refactor a bit and
 * have splay tree code in a separate file but use some common code.
 * Splay tree recursion goes two tree levels at a time but uses the
 * same rotation code and left-right/right-left cases are the same as
 * AVL trees.
 *
 * It uses a flag to determine it's AVL insertion or BST insertion.
 * Also now used for recursive search to avoid duplicating the code
 * for visualising recursion; some naming may be misleading. NOTE that
 * naming of blocks and bookmarks in the three different files must be
 * consistent! (or four different files when we add Splay trees!)
 * 
 * The insertion algorithm is implemented using the following steps:
 * 1. If the tree is empty, create new node as the root of the tree and
 *    return.
 * 2. Compare the key to be inserted with the current node's key, 
 *    and recursively insert the key into the left or right subtree.
 * 3. BST: Return the root node DONE.
 * 3. AVL: Update the height of the root node based on the heights of 
 *    its children.
 * 4. Check the balance factor of the root node and rebalance using
 * rotation(s) if needed.
 * 5. Return the root node.
 */ 

import GraphTracer from '../../components/DataStructures/Graph/GraphTracer';
import Array1DTracer from '../../components/DataStructures/Array/Array1DTracer';
import { areExpanded } from './collapseChunkPlugin';
import SplayTree from './splaytree';

// Moving to new color scheme
// XXX Currently code is a bit shit  due to previous use of older color
// scheme interface - worth cleaning up
import {BSTColors as colors} from './BSTColors';

// remove any highlighting etc from tree XXX also in AVLTreeSearch.js
let uncolor = (graph, root) => {
  if (root) {
    // console.log(root, root.key, root.left, root.right);
    graph.setNodeColor(root.key, undefined);
    uncolor(graph, root.left);
    uncolor(graph, root.right);
  }
}


// Global flag for insert/search (set when controller init is run)
let isInsert = true;

// checks if either recursive call is expanded
function isRecursionExpanded() {
  let mode = (isInsert ? 'insertion' : 'search');
  return areExpanded(['recurseLeft'], mode)
      || areExpanded(['recurseRight'], mode);
}

let globalRoot;
let isAVL = false; // flag for AVLT/BST (needed for height)
// Tree Node class
class TreeNode {
	constructor(key) {
	this.key = key;
	this.left = null;
	this.right = null;
	if (isAVL) {
		this.height = 1;
	}
    }
}

// For search, we extract the tree from the visualiser as a flat mapping
// (associative array) between keys and (keys of roots of) children (if they
// exist/are defined), and separately extract the root. This is (probably)
// the representation used in the initial BST coding and doesn't allow
// duplicate keys (if we change our mind about allowing duplicate keys is
// might be a significant rewrite): It is not the representation used in
// AVL trees and the recursive BST implementation for search, so we need
// to convert the flat representation to the nested/recursive one.
function treeFromFlatTree(root, flatTree) {
    if (flatTree[root.key].left) {
        root.left = new TreeNode(flatTree[root.key].left);
        treeFromFlatTree(root.left, flatTree);
    }
    if (flatTree[root.key].right) {
        root.right = new TreeNode(flatTree[root.key].right);
        treeFromFlatTree(root.right, flatTree);
    }
}

// XXX popAfterReturnFlag seems to be used in a dodgy way, being set
// and tested inside chunks as a global variable, not passed into chunks
// as an argument. Because of the collapseChunkPlugin stuff stepping
// backwards re-executes from the start so it seems to work but is
// fagile (and the initial value of false may not be the initial value
// when re-executing).
let popAfterReturnFlag = false;

// Previously this code used the old colour scheme and had things like
// vis.graph.visit(rl,r) that coloured two nodes plus the edge between
// them, and vis.graph.resetVisitAndSelect(t2, t6) that reset colours.
// To make changing to the new colour interface easier we have
// reproduced a similar interface for the old code.
// XXX best rename now.
// We need some global variables to keep track of what things have been
// coloured - Boo, hiss   XXX would be good to clean this up
let newNode,
  rotNodes = [],
  rotEdges = [];

// n2 -> n1 is involved in rotation - colour nodes and edge
// (leave newNode as is)
let graph_visit = (graph, n1, n2) => {
  if (n1 !== newNode) {
    graph.setNodeColor(n1, colors.ROT_N);
    rotNodes.push(n1);
  }
  if (n2 !== newNode) {
    graph.setNodeColor(n2, colors.ROT_N);
    rotNodes.push(n2);
  }
  graph.setEdgeColor(n2, n1, colors.ROT_E);
  rotEdges.push([n2,n1]);
};

// reset colours set above
let graph_reset = (graph, n1, n2) => {
  if (n1 !== newNode) {
    graph.setNodeColor(n1, undefined);
  }
  if (n2 !== newNode) {
    graph.setNodeColor(n2, undefined);
  }
  graph.setEdgeColor(n2, n1, undefined);
};

// clears all the colouring set above
let graph_clear = (graph) => {
  rotNodes.forEach(n => {graph.setNodeColor(n, undefined);});
  rotNodes = [];
  rotEdges.forEach(n => {graph.setEdgeColor(n[0], n[1], undefined);});
  rotEdges = [];
};

/**
 * Insert a key into the tree recursively
 * 
* @param {TreeNode} root the root node of the tree
* @param {int} key the key to be inserted
* @param {int} currIndex the index of the key in the array
* @param {TreeNode} parentNode the parent node of the root node
* @param {int} depth the recursive depth of this action
* @returns {TreeNode} the new root node after the insertion
 */
function insertOrSearchRec(chunker, root, key, currIndex, parentNode = null, depth = 1) {
    let retVal; // return value

    // Function to update the height of a node based on its children's heights (AVL only)
    function updateHeight(root) {
        if (isAVL && root !== null) {
            const leftHeight = root.left ? root.left.height : 0;
            const rightHeight = root.right ? root.right.height : 0;
            root.height = 1 + Math.max(leftHeight, rightHeight); // pick the maximum height then add 1
        }
    }
    
    /**
    * compute node positions during rotation
    * given x-y coordinates of the root and the child, compute the
    * intermediate position after step 1, step 2, ...
    * coords represented as record with fields rX, rY, cX, cY (root X&Y,
    * child X&Y)
    * Steps 1&2:
    * We keep the edge the same length and rotate it around the point 40%
    * along the edge from the root.  If initially the y coordinate of the
    * root is 1 and the child is zero, after step 1 the root is at 2/3
    * and the child is at 1/2 and after step 2 the root is at 1/3 and the
    * child is at 1.  The x coordinates are computed so as to keep the length
    * of the edge same (magic numbers derived from maths).
    * returns record with new coordinates
    * Further steps:
    * Not coded here but in the next steps the (new) root is moved
    * more towards the center and the (new) child (and it's child?)
    * is moved down.
    * (AVL only)
    */
    function rotateStep(pos0, step) {
        let {rX, rY, cX, cY} = pos0;
        let deltaX = rX - cX;
        let deltaY = rY - cY;
        // edge length = sqrt(deltaX**2 + deltaY**2)
        let deltaX1; // deltaX for new position
        let pos1 = {rX:0, rY:0, cX:0, cY:0};
        if (step === 1) {
            pos1.rY = (2*rY + cY) / 3;
            pos1.cY = (rY + cY) / 2;
            deltaX1 = Math.sqrt((35/36)*deltaY**2 + deltaX**2);
        } else if (step === 2) {
            pos1.rY = (rY + 2*cY) / 3;
            pos1.cY = rY;
            deltaX1 = Math.sqrt((5/9)*deltaY**2 + deltaX**2);
        } else {
            console.log('Invalid rotateStep step ', step);
        }
        if (rX > cX) // reverse direction of deltaX
            deltaX1 = -deltaX1;
        pos1.rX = (0.6*rX + 0.4*cX) - 0.4*deltaX1;
        pos1.cX = (0.6*rX + 0.4*cX) + 0.6*deltaX1;
        return pos1;
    }
    
    // XXX better to rename this rightRotate...
    /**
     * Perform a Left-Left Case Rotation (LLCR) to balance the AVL tree
     * @param {AVLNode} root the root node of the AVL tree
     * @param {AVLNode} parentNode the parent node of the root node
     * @param {int} depth the recursive depth of this action
     * @param {boolean} rotateVis whether to highlight the rotation in the visualisation.
     *                            The default value is true,
     *                            should be set to false when the rotation is the middle step
     * @returns {AVLNode} the new root node after the rotation
     */
    function LLCR(root, parentNode, depth, rotateVis = true) {
        if (!isAVL) return root;
    
        // assign the root as t6 in the pseudocode
        chunker.add('rightRotate(t6)',
            (vis, r, rl, rll) => {
                graph_clear(vis.graph);
                // vis.graph.clearSelect_Circle_Count();
                // show tid of t6 on the graph
                vis.graph.updateTID(r, 't6');
    
                // cancel highlighting of the edges (r->rl, rl->rll)
                // they were highlighted when the case was detected
                graph_visit(vis.graph, rl,r);
                // vis.graph.findNode(r).visitedCount = 1;
              
            }, [root.key, root.left.key, root.left.left ? root.left.left.key : null],
            depth
        );
    
        let R = root; // if any doubt, refer to the charNotation above
        let A = root.left;
    
        // assign the left child of the root as t2 in the pseudocode
        chunker.add('t2 = left(t6)',
            (vis, tt2, tt6) => {
                // show tid of t2 on the graph
                vis.graph.updateTID(tt2, 't2');
    
                // -- following code is for visualising the rotation step by step --
                // find the position of the nodes in the graph
                let rootNode = vis.graph.findNode(tt6);
                let leafNode = vis.graph.findNode(tt2);
                // store the previous height of the root node
                let pos0 = {rX:rootNode.x, rY:rootNode.y, cX:leafNode.x, cY:leafNode.y};
                vis.graph.setRotPos(pos0);
                let pos = rotateStep(pos0, 1); // compute new position
                vis.graph.setNodePosition(tt6, pos.rX, pos.rY);
                vis.graph.setNodePosition(tt2, pos.cX, pos.cY);
            },
            [A.key, R.key],
            depth
        );
    
        let D = A.right;
        // assign the right child of t2 as t4 in the pseudocode
        chunker.add('t4 = right(t2)',
            (vis, tt6, tt2, tt4) => {
                // show tid of t4 on the graph
                if (tt4) {
                    vis.graph.updateTID(tt4, 't4');
                } else {
                    // if t4 is null, show "t4 is Empty" on the graph
                    vis.graph.setTagInfo('t4 ');
                }
    
                // -- following code is for visualising the rotation step by step --
                // freeze the layout to avoid the nodes moving automatically
                vis.graph.setPauseLayout(true);
                let pos0 = vis.graph.getRotPos(); // original position
                let pos = rotateStep(pos0, 2); // compute new position
                vis.graph.setNodePosition(tt6, pos.rX, pos.rY);
                vis.graph.setNodePosition(tt2, pos.cX, pos.cY);
            },
            [R.key, A.key, D ? D.key : false],
            depth
        );
    
        // let t2's right child point to t6
        chunker.add('t2.right = t6',
            (vis, t6, t2, t4, p, rotate) => {
                graph_reset(vis.graph, t2, t6);
                vis.graph.removeEdge(t6, t2);
    
                if (t4 !== null) {
                    vis.graph.removeEdge(t2, t4);
                }
    
                if (rotate) graph_reset(vis.graph, t6, null);
    
                vis.graph.addEdge(t2, t6);
                graph_visit(vis.graph, t6, t2);
    
                if (t4 !== null) vis.graph.removeEdge(t6, t4);
                // set the new position of the node(s)
                // - just move (new) root node towards center more.
                // New child and grandchild moved in next chunk -
                // could do them here also but less confusing as is?
                let pos0 = vis.graph.getRotPos(); // original position
                let pos2 = rotateStep(pos0, 2); // previous position
                vis.graph.setNodePosition(t2, (pos0.rX + 3*pos0.cX)/4, pos2.cY);
            },
            [R.key, A.key, D ? D.key : null, parentNode ? parentNode.key : null, rotateVis],
            depth
        );
    
        let RR = (R.right? R.right.key: null);
        // if t4 is not null, let t6's left child point to t4
        // if (D) { // we now animate this step even if t4 is null
        chunker.add('t6.left = t4',
            (vis, t6, t6r, t2, t4, p, rotate) => {
                // vis.graph.setMoveRatio(9/10);
                if (t4 !== null) vis.graph.addEdge(t6, t4);
                // set the new position of the nodes
                // - just move (new) child node down more
                // plus it's child also (if it has one)
                let pos0 = vis.graph.getRotPos(); // original position
                let pos2 = rotateStep(pos0, 2); // position after step 2
                let deltaY = (pos2.rY - pos0.rY) / 3;
                vis.graph.setNodePosition(t6, pos2.rX, pos2.rY + deltaY);
                if (t6r !== null) {
                    vis.graph.moveNodePosition(t6r, 0, deltaY);
                }
            },
            [R.key, RR, A.key, D ? D.key : null, parentNode ? parentNode.key : null, rotateVis],
            depth
        )
    
        // perform the rotation in our objects
        const temp = root.left; // XXX temp = A ???
        root.left = temp.right;
        temp.right = root;
        updateHeight(root);
        updateHeight(temp);
    
        // update height in the graph, it will overwrite the tid as well
        chunker.add('recompute heights of t6 and t2', (vis, r, h1, t, h2, d, h3) => {
            vis.graph.setTagInfo('');
            vis.graph.updateHeight(r, h1);
            vis.graph.updateHeight(t, h2);
            if (d !== null) vis.graph.updateHeight(d, h3);
        },
            [root.key, root.height, temp.key, temp.height, D ? D.key : null, D ? D.height : 0],
            depth,
        );
    
        // update the parent node's child
        if (parentNode !== null) {
            if (temp.key < parentNode.key) {
                parentNode.left = temp;
            }
            else {
                parentNode.right = temp;
            }
        }
    
        // finalise the rotation
        chunker.add('return t2',
            (vis, g, p, t2, t6) => {
                // vis.graph.clearTID();
                vis.graph.updateTID(t2, 't2');
                if (p !== null) {
                    vis.graph.removeEdge(p, t6);
                    vis.graph.addEdge(p, t2);
                }
    
                // vis.graph.clearSelect_Circle_Count();
                graph_clear(vis.graph);
              
                vis.graph.setMoveRatio(3/6);
                vis.graph.setPauseLayout(false);
                vis.graph.layoutAVL(g, true, false);
                vis.graph.rectangle_size();
            },
            [parentNode ? globalRoot.key : temp.key, parentNode ? parentNode.key : null, A.key, R.key],
            depth
        );
    
        return temp; // new root node after the rotation
    }
    
    
    /**
     * Perform a Right-Right Case Rotation (RRCR) to balance the AVL tree
     * @param {AVLNode} root the root node of the AVL tree
     * @param {AVLNode} parentNode the parent node of the root node
     * @param {int} depth the recursive depth of this action
     * @param {boolean} rotateVis whether to highlight the rotation in the visualisation.
     *                            The default value is true,
     *                            should be set to false when the rotation is the middle step
     * @returns {AVLNode} the new root node after the rotation
     */
    function RRCR(root, parentNode, depth, rotateVis = true) {
        if (!isAVL) return root;
    
        // assign the root as t2 in the pseudocode
        chunker.add('leftRotate(t2)',
            (vis, r, rr, rrr) => {
    
                graph_clear(vis.graph);
                // vis.graph.clearSelect_Circle_Count();
                // show tid of t2 on the graph
                vis.graph.updateTID(r, 't2');
    
                graph_visit(vis.graph, rr,r);
    
            }, [root.key, root.right.key, root.right.right ? root.right.right.key : null],
            depth
        );
    
        let R = root; // if any doubt, refer to the charNotation above
        let A = root.right;
    
        // assign the right child of the root as t6 in the pseudocode
        chunker.add('t6 = right(t2)',
            (vis, tt6, tt2) => {
                // show tid of t6 on the graph
                vis.graph.updateTID(tt6, 't6');
    
                // -- following code is for visualising the rotation step by step --
                // find the position of the nodes in the graph
                let rootNode = vis.graph.findNode(tt2);
                let leafNode = vis.graph.findNode(tt6);
                // store the previous height of the root node
                let pos0 = {rX:rootNode.x, rY:rootNode.y, cX:leafNode.x, cY:leafNode.y};
                vis.graph.setRotPos(pos0);
                let pos = rotateStep(pos0, 1); // compute new position
                vis.graph.setNodePosition(tt2, pos.rX, pos.rY);
                vis.graph.setNodePosition(tt6, pos.cX, pos.cY);
            },
            [A.key, R.key],
            depth
        );
        let D = A.left;
        // assign the left child of t6 as t4 in the pseudocode
        chunker.add('t4 = left(t6)',
            (vis, tt2, tt6, tt4) => {
                // show tid of t4 on the graph
                if (tt4) {
                    vis.graph.updateTID(tt4, 't4');
                } else {
                    // if t4 is null, show "t4 is Empty" on the graph
                    vis.graph.setTagInfo('t4 ');
                }
    
                // -- following code is for visualising the rotation step by step --
                // freeze the layout to avoid the nodes moving automatically
                vis.graph.setPauseLayout(true);
                // set the new position of the nodes
                let pos0 = vis.graph.getRotPos(); // original position
                let pos = rotateStep(pos0, 2); // compute new position
                vis.graph.setNodePosition(tt2, pos.rX, pos.rY);
                vis.graph.setNodePosition(tt6, pos.cX, pos.cY);
            },
            [R.key, A.key, D ? D.key : false],
            depth
        );
    
        // let t6's left child point to t2
        chunker.add('t6.left = t2',
            (vis, t2, t6, t4, p, rotate) => {
                // highlight the edge between t6 and t2
                // if (rotate) graph_visit(vis.graph, t2, p);
                graph_reset(vis.graph, t6, t2);
                vis.graph.removeEdge(t2, t6);
    
                if (t4 !== null) {
                    vis.graph.removeEdge(t6, t4);
                }
    
                if (rotate) graph_reset(vis.graph, t2, null);
    
                vis.graph.addEdge(t6, t2);
                graph_visit(vis.graph, t2, t6);
                // remove edge after layout to perform the middle step
                if (t4 !== null) vis.graph.removeEdge(t2, t4);
                // set the new position of the nodes
                // - just move (new) root node towards center more.
                // New child and grandchild moved in next chunk -
                // could do them here also but less confusing as is?
                let pos0 = vis.graph.getRotPos(); // original position
                let pos2 = rotateStep(pos0, 2); // previous position
                vis.graph.setNodePosition(t6, (pos0.rX + 3*pos0.cX)/4, pos2.cY);
            },
            [R.key, A.key, D ? D.key : null, parentNode ? parentNode.key : null, rotateVis],
            depth
        );
    
        let RL = (R.left? R.left.key: null);
        // if t4 is not null, let t2's right child point to t4
        // if (D) { // we now animate this step even if t4 is null
        chunker.add('t2.right = t4',
            // reconnect the edge between t2 and t4
            (vis, t2, t2l, t6, t4, p, rotate) => {
                if (t4 !== null) vis.graph.addEdge(t2, t4);
                // set the new position of the nodes
                // - just move (new) child node down more
                // plus it's child also (if it has one)
                let pos0 = vis.graph.getRotPos(); // original position
                let pos2 = rotateStep(pos0, 2); // position after step 2
                let deltaY = (pos2.rY - pos0.rY) / 3;
                vis.graph.setNodePosition(t2, pos2.rX, pos2.rY + deltaY);
                if (t2l !== null) {
                    vis.graph.moveNodePosition(t2l, 0, deltaY);
                }
            },
            [R.key, RL, A.key, D ? D.key : null, parentNode ?  parentNode.key : null, rotateVis],
            depth
            )
        // }
    
        // perform the rotation in our objects
        const temp = root.right;
        root.right = temp.left;
        temp.left = root;
        updateHeight(root);
        updateHeight(temp);
    
        // update height in the graph
        chunker.add('recompute heights of t2 and t6', (vis, r, h1, t, h2, d, h3) => {
            vis.graph.setTagInfo('');
            vis.graph.updateHeight(r, h1);
            vis.graph.updateHeight(t, h2);
            if (d !== null) vis.graph.updateHeight(d, h3);
        },
            [root.key, root.height, temp.key, temp.height, D ? D.key : null, D ? D.height : 0],
            depth,
        );
    
        // update the parent node's child
        if (parentNode !== null) {
            if (temp.key < parentNode.key) {
                parentNode.left = temp;
            }
            else {
                parentNode.right = temp;
            }
        }
    
        // finalise the rotation
        chunker.add('return t6',
            (vis, g, p, t6, t2) => {
                vis.graph.updateTID(t6, 't6');
                if (p !== null) {
                    vis.graph.removeEdge(p, t2);
                    vis.graph.addEdge(p, t6);
                }
                // vis.graph.clearSelect_Circle_Count();
                graph_clear(vis.graph);
                vis.graph.setMoveRatio(3/6);
                vis.graph.setPauseLayout(false);
                vis.graph.layoutAVL(g, true, false);
                vis.graph.rectangle_size();
            },
            [parentNode ? globalRoot.key : temp.key, parentNode ? parentNode.key : null, A.key, R.key],
            depth
        );
        return temp; // new root node after the rotation
    }
    
    
    /**
     * Perform a Left-Right Case Rotation (LRCR) to balance the AVL tree
     * 
     * Performs a left rotation on the left child of the root node first,
     * then performs a right rotation on the root node
     * 
     * @param {AVLNode} root the root node of the AVL tree
     * @param {AVLNode} parentNode the parent node of the root node
     * @param {int} depth the recursive depth of this action
     * @returns {AVLNode} the new root node after the rotation
     */
    function LRCR(root, parentNode, depth) {
        if (!isAVL) return root;
        
        // perform left rotation on the left child of the root node
        root.left = RRCR(root.left, root, depth, false);
    
        // highlight the rotation in the visualisation
        chunker.add('left(t) <- leftRotate(left(t));',
            (vis, g, r) => {
                vis.graph.updateHeight(r.key, r.height);
                vis.graph.setPauseLayout(false);
                vis.graph.layoutAVL(g, true, false);
                vis.graph.rectangle_size();
            }, [(parentNode !== null) ? globalRoot.key : root.key, root.left], depth);
    
        // chunker.add('return right rotation on t', (vis) => { }, [], depth);
    
        // perform right rotation on the root node
        return LLCR(root, parentNode, depth, true);
    }
    
    /**
     * Perform a Right-Left Case Rotation (RLCR) to balance the AVL tree
     * 
     * Performs a right rotation on the right child of the root node first,
     * then performs a left rotation on the root node
     * 
     * @param {AVLNode} root the root node of the AVL tree
     * @param {AVLNode} parentNode the parent node of the root node
     * @param {int} depth the recursive depth of this action
     * @returns {AVLNode} the new root node after the rotation
     */
    function RLCR(root, parentNode, depth) {
        if (!isAVL) return root;
    
        // perform right rotation on the right child of the root node
        root.right = LLCR(root.right, root, depth, false);
    
        // highlight the rotation in the visualisation
        chunker.add('right(t) <- rightRotate(right(t));',
            (vis, g, r) => {
                vis.graph.updateHeight(r.key, r.height);
                vis.graph.setPauseLayout(false);
                vis.graph.layoutAVL(g, true, false);
                vis.graph.rectangle_size();
            }, [(parentNode !== null) ? globalRoot.key : root.key, root.right], depth);
    
    
        // perform left rotation on the root node
        return RRCR(root, parentNode, depth, true);
    }
    
    
    // init global fagl used for colouring
    rotNodes = [];
    rotEdges = [];
    // visualise the basic information of the insertion
    chunker.add(`Main`,
        (vis, k, d, index, r, p, rr) => {
            if (d === 1) {
                // remove any message about ignoring
                // duplicate keys
                // XXX nicer to have this in the last chunk,
                // along with removing rectangles in AVL
                // (but many chunks can be the last so we do
                // this for now)
                vis.graph.setText('');
            }
            if (popAfterReturnFlag) { // Not needed here???
                vis.graph.popRectStack();
                vis.graph.setNodeColor(rr, undefined);
                popAfterReturnFlag = false;
            }
            if (rr) {
                // visit from root to root, to just highlight the current node, without highlighting the edge
                // graph_visit(vis.graph, rr, rr);
                vis.graph.setNodeColor(rr, colors.PATH_N);
            }
            // print the function name and the key to be inserted
            if (isInsert)
                vis.graph.setFunctionName(`Insert: ${k}`);
            else
                vis.graph.setFunctionName(`Search: ${k}`);
            vis.graph.setFunctionInsertText();
            
            // Only add rectangles when recursion is expanded
            if (isRecursionExpanded()) {
                if (rr) {
                    let nodeIds = vis.graph.getSubtreeNodes(rr);
                    vis.graph.pushRectStack(nodeIds, `Depth ${d}`);
                }
                else {
                    // add temporary node
                    vis.graph.addNode(k, k);
                    if (p !== null) {
                        vis.graph.addEdge(p, k);
                    }
                    vis.graph.addNodeToRectStack(k, p);
                    if (isAVL) {
                        vis.graph.updateHeight(k, 1);
                    }
                    // Add a rectangle for the node
                    vis.graph.pushRectStack([k], `Depth ${d}`);
                    // Add a empty rectangle to display "Empty"
                    vis.graph.pushRectStack([], 'Empty');
                    vis.graph.rectangle_size();
                    // Pause the layout then remove the node
                    vis.graph.setPauseLayout(true);
                    vis.graph.removeNode(k);
                }
            }
        },
        [key, depth, currIndex, root ? `...${root.key}...` : "Empty", parentNode ? parentNode.key : null, root ? root.key : null],
        depth
    );

    chunker.add('if t = Empty', (vis) => null, [], depth);
    // Search base cases:
    // if the tree is empty set message
    if (root === null && !isInsert) {
        // chunker.add('if t = Empty', (vis) => null, [], depth);
        chunker.add('return NotFound',
            (vis, r, p) => {
                // Pop the "Empty" rectangle
                popAfterReturnFlag = true;
                vis.graph.setText('Key not found');
            },
            [key, parentNode ? parentNode.key : null],
            depth
        );
        return 'fail';
    } else if (!isInsert && root.key == key) {
        chunker.add('if n.key = k',
            (vis, k) => {
                vis.graph.setNodeColor(k, colors.FOUND_N);
            }
            , [key], depth);
        chunker.add('return t',
            (vis, r, p) => {
                popAfterReturnFlag = true;
                vis.graph.setText('Key found');
                // XXX want to highlight node here (also highlight
                // inserted nodes); remove highlight at end of insert
            },
            [key, parentNode ? parentNode.key : null],
            depth
        );
        return 'success';
    }

    // Insertion: if the tree is empty, create a new node as the root
    // We pop the Empty rectangle but create a new one around the new
    // node (if it has a parent)
    if (root === null && isInsert) {
        // chunker.add('if t = Empty', (vis) => null, [], depth);

        // Initialize the AVL tree with the first key
        let root = new TreeNode(key);

        // chunker.add('create new node',
        chunker.add('return n',
            (vis, r, p) => {
                // Pop the "Empty" rectangle
                vis.graph.popRectStack();
                vis.graph.setPauseLayout(false);
                vis.graph.addNode(r, r);
                newNode = r;
                vis.graph.setNodeColor(r, colors.NEW_N);
                if (isAVL) {
                    vis.graph.updateHeight(r, 1);
                }
                if (p !== null) { // not needed??
                    vis.graph.addEdge(p, r);
                    vis.graph.addNodeToRectStack(r, p);
                    // now pause layout and remove edge (added again next chunk)
                    vis.graph.setPauseLayout(true);
                    vis.graph.removeEdge(p, r);
                }
                vis.graph.rectangle_size();
                popAfterReturnFlag = true;
            },
            [key, parentNode ? parentNode.key : null],
            depth
        );

        // update the child of the parent node
        if (parentNode !== null) {
            if (key < parentNode.key) {
                parentNode.left = root;
            } else {
                parentNode.right = root;
            }
        }

        return root;
    }

    chunker.add('if k < t.key', (vis) => { }, [], depth);

    // For search we don't have return at end; instead we return
    // directly from left or right recursive calls and we need to save
    // which one so we cal unwind recursion properly (animation stops
    // twice at recursive calls)
    let searchBookmark;
    if (key < root.key) {
        chunker.add('prepare for the left recursive call', (vis) => null, [], depth);

        // Recursively insert the key into the left subtree
        retVal = insertOrSearchRec(chunker, root.left, key, currIndex, root, depth + 1);

        // restore the function information after the recursive call
        chunker.add(`recursiveCallLeft`,
            (vis, subtree, k, r) => {
                if (!subtree) {
                    // Search (unsuccessful): pop "Empty" rectangle
                    vis.graph.popRectStack();
                    vis.graph.setNodeColor(r.key, undefined);
                } else if (isInsert && subtree.key == k) {
                    // Inserted into child: add edge
                    vis.graph.addEdge(r.key, k);
                }
                vis.graph.setPauseLayout(false);
                vis.graph.setFunctionInsertText();
                if (popAfterReturnFlag) {
                    vis.graph.popRectStack();
                    if (subtree && subtree.key !== k)
                        vis.graph.setNodeColor(subtree.key, undefined);
                    vis.graph.rectangle_size();
                    popAfterReturnFlag = false;
                }
                popAfterReturnFlag = true;
            },
            [root.left, key, root],
            depth);
            searchBookmark = `recursiveCallLeft`;

    } else if (key > root.key) {
        chunker.add('else if k > root(t).key', (vis) => null, [], depth);
        chunker.add('prepare for the right recursive call', (vis) => null, [], depth);

        // Recursively insert the key into the right subtree
        retVal = insertOrSearchRec(chunker, root.right, key, currIndex, root, depth + 1);

        // restore the function information after the recursive call
        chunker.add(`recursiveCallRight`,
            (vis, subtree, k, r) => {
                if (!subtree) {
                    // Search (unsuccessful): pop "Empty" rectangle
                    vis.graph.popRectStack();
                } else if (isInsert && subtree.key == k) {
                    // Inserted into child: add edge
                    vis.graph.addEdge(r.key, k);
                }
                vis.graph.setPauseLayout(false);
                vis.graph.setFunctionInsertText();
                if (popAfterReturnFlag) {
                    vis.graph.popRectStack();
                    if (subtree && subtree.key !== k)
                        vis.graph.setNodeColor(subtree.key, undefined);
                    vis.graph.rectangle_size();
                    popAfterReturnFlag = false;
                }
                popAfterReturnFlag = true;
            },
            [root.right, key, root],
            depth);
            searchBookmark = `recursiveCallRight`;
    } else {
        // Key already exists in the tree (insert)
        chunker.add('else if k > root(t).key',
            (vis) => {
                // graph_clear(vis.graph); // clear all highlighting
                vis.graph.setText('Duplicate key - insertion ignored');
                // popAfterReturnFlag = true;
            },
            [],
            depth
        );
        // chunker.add('return t, no change', (vis) => null, [], depth);
        // return root;
    }

    // BST Search case: just return XXX ?need clean up
    // BST Insert case: chunk for return statement then return
    // AVL Insert case: fall though to balance/rotations code
    let bookmark;
    if (isInsert) {
       bookmark = 'return t';
       retVal = root
    } else
       return retVal;
    if (!isAVL) {
        // XXX only want this extra chunk for insert
        // (may need to add contents to previous chunk
        chunker.add(bookmark,
            (vis, r, p) => {
                // graph_reset(vis.graph, r, p);
                // popAfterReturnFlag = true;
            },
            [root.key, parentNode ? parentNode.key : null],
            depth
        );
        return retVal;
    }

    updateHeight(root);

    // update height in the graph
    chunker.add('root(t).height = 1 + max(left(t).height, right(t).height)',
        (vis, r, h) => {
            vis.graph.updateHeight(r, h);
        },
        [root.key, root.height],
        depth
    );

    // get balance factor of the root
    const leftHeight = root.left ? root.left.height : 0;
    const rightHeight = root.right ? root.right.height : 0;
    const balance = leftHeight - rightHeight;

    // update the balance factor in the graph
    chunker.add('switch balanceCase of', (vis, r) => {
        vis.graph.setFunctionNode(`${r}`);
        // vis.graph.clearSelect_Circle_Count();
        // vis.graph.setSelect_Circle_Count(r);
        vis.graph.setFunctionBalance(balance);
    }, [root.key], depth);

    // the rotation helper functions are deeply nested in the insert function
    // more details can be referred to the QuickSort controller
    // and recursionLevel in ../context/action.js
    let rotateDepth = depth + 1;

    // check the balance factor and perform rotations if necessary
    // chunker.add('if balance > 1 && k < left(t).key', (vis) => null, [], depth);
    if (balance > 1 && key < root.left.key) {
        // detect LL case
        chunker.add('perform right rotation to re-balance t',
            (vis, r, b, rl, rll) => {
                // show the rotation type and the node to be rotated
                vis.graph.setFunctionInsertText(` balanceCase: LL`);
                // vis.graph.clearSelect_Circle_Count();
                // vis.graph.setSelect_Circle_Count(r);
                vis.graph.setFunctionNode(`${r}`);

                // highlight edges involved in the rotation case
                graph_clear(vis.graph);
                graph_visit(vis.graph, rl, r);
                graph_visit(vis.graph, rll, rl);

            },
            [root.key, balance, root.left.key, root.left.left ? root.left.left.key : null],
            depth
        );
        root = LLCR(root, parentNode, rotateDepth);

        // clear the function information after the rotation
        // and tidy up the nodes' position
        chunker.add('return rightRotate(t)', (vis, g, r) => {
            vis.graph.setMoveRatio(1);
            vis.graph.updateHeight(r.key, r.height);
            vis.graph.setFunctionNode(null);
            // vis.graph.clearSelect_Circle_Count();
            vis.graph.setFunctionBalance(null);
            // vis.graph.clearSelect_Circle_Count();
            graph_clear(vis.graph);
            vis.graph.setPauseLayout(false);
            vis.graph.layoutAVL(g, true, false);
            vis.graph.rectangle_size();
            popAfterReturnFlag = true;
        }, [(parentNode !== null) ? globalRoot.key : root.key, root], depth);
    } else if (balance < -1 && key > root.right.key) {
        // chunker.add('if balance < -1 && k > right(t).key', (vis) => null, [], depth);
        // detect RR case
        chunker.add('perform left rotation to re-balance t',
            (vis, r, b, rr, rrr) => {
                // show the rotation type and the node to be rotated
                vis.graph.setFunctionInsertText(` balanceCase: RR`);
                vis.graph.setFunctionNode(`${r}`);
                // vis.graph.clearSelect_Circle_Count();
                // vis.graph.setSelect_Circle_Count(r);

                // highlight edges involved in the rotation case
                graph_clear(vis.graph);
                graph_visit(vis.graph, rr, r);
                graph_visit(vis.graph, rrr, rr);
            },
            [root.key, balance, root.right.key, root.right.right ? root.right.right.key : null],
            depth
        );

        root = RRCR(root, parentNode, rotateDepth);

        // clear the function information after the rotation
        // and tidy up the nodes' position
        chunker.add('return leftRotate(t)', (vis, g, r) => {
            vis.graph.setMoveRatio(1);
            vis.graph.updateHeight(r.key, r.height);
            vis.graph.setFunctionNode(null);
            vis.graph.setFunctionBalance(null);
            // vis.graph.clearSelect_Circle_Count();
            graph_clear(vis.graph);
            vis.graph.setPauseLayout(false);
            vis.graph.layoutAVL(g, true, false);
            vis.graph.rectangle_size();
            popAfterReturnFlag = true;
        }, [(parentNode !== null) ? globalRoot.key : root.key, root], depth);
    } else if (balance > 1 && key > root.left.key) {
        // chunker.add('if balance > 1 && k > left(t).key', (vis) => null, [], depth);
        // detect LR case
        chunker.add('perform left rotation on the left subtree',
            (vis, r, b, rl, rlr) => {
                // show the rotation type and the node to be rotated
                vis.graph.setFunctionInsertText(` balanceCase: LR`);
                // vis.graph.clearSelect_Circle_Count();
                // vis.graph.setSelect_Circle_Count(r);
                vis.graph.setFunctionNode(`${r}`);
                
                // highlight edges involved in the rotation case
                graph_clear(vis.graph);
                graph_visit(vis.graph, rl, r);
                graph_visit(vis.graph, rlr, rl);
            },
            [root.key, balance, root.left.key, root.left.right ? root.left.right.key : null],
            depth
        );

        root = LRCR(root, parentNode, rotateDepth);
        // clear the function information after the rotation
        chunker.add('return rightRotate(t) after leftRotate',
            (vis, g, r) => {
                vis.graph.setMoveRatio(1);
                vis.graph.updateHeight(r.key, r.height);
                vis.graph.setFunctionNode(null);
                vis.graph.setFunctionBalance(null);
                // vis.graph.clearSelect_Circle_Count();
                graph_clear(vis.graph);
                vis.graph.setPauseLayout(false);
                vis.graph.layoutAVL(g, true, false);
                vis.graph.rectangle_size();
                popAfterReturnFlag = true;
            },
            [(parentNode !== null) ? globalRoot.key : root.key, root],
            depth);
    } else if (balance < -1 && key < root.right.key) {
        // chunker.add('if balance < -1 && k < right(t).key', (vis) => null, [], depth);
        // detect RL case
        chunker.add('perform right rotation on the right subtree',
            (vis, r, b, rr, rrl) => {
                // show the rotation type and the node to be rotated
                vis.graph.setFunctionInsertText(` balanceCase: RL`);
                vis.graph.setFunctionNode(`${r}`);
                // vis.graph.clearSelect_Circle_Count();
                // vis.graph.setSelect_Circle_Count(r);

                // highlight edges involved in the rotation case
                graph_clear(vis.graph);
                graph_visit(vis.graph, rr, r);
                graph_visit(vis.graph, rrl, rr);
            },
            [root.key, balance, root.right.key, root.right.left ? root.right.left.key : null],
            depth
        );

        root = RLCR(root, parentNode, rotateDepth);

        // clear the function information after the rotation
        chunker.add('return leftRotate(t) after rightRotate',
            (vis, g, r) => {
                vis.graph.setMoveRatio(1);
                vis.graph.updateHeight(r.key, r.height);
                vis.graph.setFunctionNode(null);
                vis.graph.setFunctionBalance(null);
                // vis.graph.clearSelect_Circle_Count();
                graph_clear(vis.graph);
                vis.graph.setPauseLayout(false);
                vis.graph.layoutAVL(g, true, false);
                vis.graph.rectangle_size();
                popAfterReturnFlag = true;
            }, [(parentNode !== null) ? globalRoot.key : root.key, root], depth);
    } else {
        chunker.add('case Balanced', (vis) => null, [], depth);
        chunker.add('return t',
            (vis, r, p) => {
                vis.graph.setFunctionNode(null);
                vis.graph.setFunctionBalance(null); // clear balance after return in switch case
                // graph_reset(vis.graph, r, p); // clear all highlighting
                popAfterReturnFlag = true;
            },
            [root.key, parentNode ? parentNode.key : null],
            depth
        );
    }
    return root;
}
function insertOrSearch(chunker, root, key, currIndex) {
    let r = insertOrSearchRec(chunker, root, key, currIndex, null, 1);
    chunker.add('Done', (vis, k, r) => {
        // vis.graph.setZoom(0.55);
        // Remove all the recursion rectangles first
        vis.graph.popAllRectStack();
        if (isInsert) {
            vis.graph.setFunctionName(`Inserted: ${k}`);
            vis.graph.setFunctionInsertText();
        }
        vis.graph.setNodeColor(k, undefined);
        vis.graph.setNodeColor(r, undefined);
        // vis.graph.setFunctionName(`Search: ${target}`);
        // vis.graph.setFunctionInsertText();
    }, [key, root.key], 1);
    return r;
} 

// Create a snapshot of the splay tree for transitioning between
// states in the visualisation. This function collects the keys of all nodes and
// the edges between them, as well as the key of the root node.
function createSplaySnapshot(root) {
    const nodeKeys = [];
    const edges = [];

    function visit(node) {
        if (node === null) return;

        nodeKeys.push(node.key);

        if (node.left !== null) {
            edges.push([node.key, node.left.key]);
        }

        if (node.right !== null) {
            edges.push([node.key, node.right.key]);
        }

        visit(node.left);
        visit(node.right);
    }
    visit(root);

    return {
        nodeKeys,
        edges,
        rootKey: root.key,
    };
}

// Get the path from the root to a specific key in the splay tree
// This function traverses the tree and
// records the keys of the nodes along the path to the target key.
export function getSplayTreePath(root, key) {
    const path = [];
    let current = root;

    while (current !== null) {
        path.push(current.key);
        if (key === current.key) {
            break;
        }
        current = key < current.key ? current.left : current.right;
    }
    return path;
}

// Describe the recursive Splay calls before the pure algorithm mutates the
// tree. Splay recursion advances by two BST levels at a time, so these frames
// are different from the ordinary one-node-at-a-time traversal path.
export function getSplayRecursionFrames(root, key) {
    const frames = [];
    let current = root;
    let depth = 1;
    let recursionBlock = null;

    function subtreeKeys(node, keys = []) {
        if (node === null) return keys;
        keys.push(node.key);
        subtreeKeys(node.left, keys);
        subtreeKeys(node.right, keys);
        return keys;
    }

    while (current !== null) {
        let splayCase = 'E';
        let nextRoot = null;
        let nextRecursionBlock = null;

        if (key < current.key && current.left !== null) {
            if (key < current.left.key && current.left.left !== null) {
                splayCase = 'LL';
                nextRoot = current.left.left;
                nextRecursionBlock = 'LL-recurse';
            } else if (key > current.left.key && current.left.right !== null) {
                splayCase = 'LR';
                nextRoot = current.left.right;
                nextRecursionBlock = 'LR-recurse';
            } else {
                splayCase = 'LE';
            }
        } else if (key > current.key && current.right !== null) {
            if (key > current.right.key && current.right.right !== null) {
                splayCase = 'RR';
                nextRoot = current.right.right;
                nextRecursionBlock = 'RR-recurse';
            } else if (key < current.right.key && current.right.left !== null) {
                splayCase = 'RL';
                nextRoot = current.right.left;
                nextRecursionBlock = 'RL-recurse';
            } else {
                splayCase = 'RE';
            }
        }

        frames.push({
            depth,
            nodeKeys: subtreeKeys(current),
            recursionBlock,
            rootKey: current.key,
            splayCase,
        });

        if (nextRoot === null) break;
        current = nextRoot;
        depth += 1;
        recursionBlock = nextRecursionBlock;
    }

    return frames;
}

function isSplayDepthExpanded(operationType, recursionBlocks = [], mode = 'operations') {
    const operationBlock = operationType === 'search'
        ? 'search_splay'
        : 'insert_splay';

    return areExpanded([operationBlock, ...recursionBlocks], mode);
}

function getSplayCaseLabel(splayCase, rotationCount) {
    if (rotationCount <= 0) return 'No rotation';
    if (rotationCount === 1 || splayCase === 'LE' || splayCase === 'RE') {
        return `Zig (${splayCase})`;
    }
    if (splayCase === 'LL' || splayCase === 'RR') {
        return `Zig-Zig (${splayCase})`;
    }
    return `Zig-Zag (${splayCase})`;
}

function addSplayDepthBox(graph, frame, operationType, rotationCount, recursionBlocks, mode) {
    if (!frame || !isSplayDepthExpanded(
        operationType,
        recursionBlocks,
        mode,
    )) return;

    graph.pushRectStack(frame.nodeKeys, `Depth ${frame.depth}`);
    graph.rectangle_size();
    graph.setFunctionInsertText(
        ` splayCase: ${getSplayCaseLabel(frame.splayCase, rotationCount)}`,
    );
}

function countSplayRotationsByDepth(events) {
    return events.reduce((counts, event) => {
        if (event.type !== 'rotation') return counts;
        counts[event.depth] = (counts[event.depth] || 0) + 1;
        return counts;
    }, {});
}

function getSplayCaseBookmark(splayCase) {
    return {
        LL: 'left-left',
        LR: 'left-right',
        RR: 'right-right',
        RL: 'right-left',
        LE: 'left-empty',
        RE: 'right-empty',
    }[splayCase] || 'case-empty';
}

function getSplayRotationBookmarks(direction) {
    return direction === 'right'
        ? {
            enter: 'rightRotate(t6)',
            identifyNewRoot: 't2 = left(t6)',
            identifyTransfer: 't4 = right(t2)',
            linkPivot: 't2.right = t6',
            linkTransfer: 't6.left = t4',
            returnRoot: 'return t2',
        }
        : {
            enter: 'leftRotate(t2)',
            identifyNewRoot: 't6 = right(t2)',
            identifyTransfer: 't4 = left(t6)',
            linkPivot: 't6.left = t2',
            linkTransfer: 't2.right = t4',
            returnRoot: 'return t6',
        };
}

function splayRotateStep(pos0, step) {
    const { rX, rY, cX, cY } = pos0;
    const deltaX = rX - cX;
    const deltaY = rY - cY;
    let deltaX1;
    const pos1 = { rX: 0, rY: 0, cX: 0, cY: 0 };

    if (step === 1) {
        pos1.rY = (2 * rY + cY) / 3;
        pos1.cY = (rY + cY) / 2;
        deltaX1 = Math.sqrt((35 / 36) * deltaY ** 2 + deltaX ** 2);
    } else if (step === 2) {
        pos1.rY = (rY + 2 * cY) / 3;
        pos1.cY = rY;
        deltaX1 = Math.sqrt((5 / 9) * deltaY ** 2 + deltaX ** 2);
    } else {
        console.log('Invalid rotateStep step', step);
    }

    if (rX > cX) deltaX1 = -deltaX1;
    pos1.rX = (0.6 * rX + 0.4 * cX) - 0.4 * deltaX1;
    pos1.cX = (0.6 * rX + 0.4 * cX) + 0.6 * deltaX1;

    return pos1;
}

function startSplayRotationMovement(graph, pivotKey, newRootKey, direction) {
    const pivot = graph.findNode(pivotKey);
    const child = graph.findNode(newRootKey);
    const children = graph.getTree()[pivotKey];
    const outerChildKey = direction === 'right' ? children.right : children.left;

    graph.setRotPos({ rX: pivot.x, rY: pivot.y, cX: child.x, cY: child.y, outerChildKey });
    moveSplayRotationPair(graph, pivotKey, newRootKey, 1);
}

function moveSplayRotationPair(graph, pivotKey, newRootKey, step) {
    const pos = splayRotateStep(graph.getRotPos(), step);

    graph.setNodePosition(pivotKey, pos.rX, pos.rY);
    graph.setNodePosition(newRootKey, pos.cX, pos.cY);

    graph.rectangle_size();
}

function centerSplayRotatedRoot(graph, newRootKey) {
    const pos0 = graph.getRotPos();
    const pos2 = splayRotateStep(pos0, 2);

    graph.setNodePosition(newRootKey, (pos0.rX + 3 * pos0.cX) / 4, pos2.cY);

    graph.rectangle_size();
}

function lowerSplayRotatedPivot(graph, pivotKey) {
    const pos0 = graph.getRotPos();
    const pos2 = splayRotateStep(pos0, 2);
    const deltaY = (pos2.rY - pos0.rY) / 3;

    graph.setNodePosition(pivotKey, pos2.rX, pos2.rY + deltaY);

    if (pos0.outerChildKey !== null && pos0.outerChildKey !== undefined) {
        const tree = graph.getTree();

        const move = key => {
            if (key === null || key === undefined) return;

            graph.moveNodePosition(key, 0, deltaY);
            move(tree[key].left);
            move(tree[key].right);
        };

        move(pos0.outerChildKey);
    }

    graph.rectangle_size();
}

// Register the visual stages for one rotation reported by the pure Splay
// Tree. The algorithm event contains only node keys; this helper translates
// them into the same t2/t4/t6 pointer operations used by the AVL animation.
export function addSplayRotationChunk(
    chunker,
    event,
    operationType = 'insert',
    rotationCount = 1,
    renderedRootKey = null,
    includeCaseStep = true,
    mode = 'operations',
) {
    const bookmarks = getSplayRotationBookmarks(event.direction);
    const rotationName = `${event.direction === 'right' ? 'Right' : 'Left'} rotation: ${event.pivotKey}`;
    const caseLabel = getSplayCaseLabel(event.splayCase, rotationCount);
    const rotationDepth = event.depth + 1;

    if (includeCaseStep) {
        chunker.add(
            getSplayCaseBookmark(event.splayCase),
            (vis, rotation) => {
                const graph = vis.graph;

                // When recursive Splay calls return, discard boxes belonging
                // to deeper calls before animating the current rotation.
                while (
                    graph.rectangles
                    && graph.rectangles.length > rotation.depth
                ) {
                    graph.popRectStack();
                }

                graph.setFunctionName(
                    `${caseLabel}: rotate ${rotation.pivotKey}`,
                );
                if (graph.setFunctionInsertText) {
                    graph.setFunctionInsertText(` splayCase: ${caseLabel}`);
                }
            },
            [event],
            event.depth,
        );
    }

    // Select this case's rotation call before entering the shared primitive.
    // Symmetric cases have distinct bookmarks even when they rotate alike.
    chunker.add(event.bookmark, () => {}, [event], event.depth);

    chunker.add(
        bookmarks.enter,
        (vis, rotation) => {
            const graph = vis.graph;

            graph.setPauseLayout(true);
            if (graph.clearTID) graph.clearTID();

            // Remove traversal or previous-rotation colours before showing
            // the current rotation.
            graph.nodes.forEach(({ id }) => {
                graph.setNodeColor(id, undefined);
            });
            graph.edges.forEach(({ source, target }) => {
                graph.setEdgeColor(source, target, undefined);
            });

            if (graph.updateTID) {
                graph.updateTID(
                    rotation.pivotKey,
                    rotation.direction === 'right' ? 't6' : 't2',
                );
            }
            graph.setNodeColor(rotation.pivotKey, colors.ROT_N);
            graph.setFunctionName(rotationName);
            if (graph.setFunctionInsertText) {
                graph.setFunctionInsertText(` splayCase: ${caseLabel}`);
            }
        },
        [event],
        rotationDepth,
    );

    chunker.add(
        bookmarks.identifyNewRoot,
        (vis, rotation) => {
            const graph = vis.graph;

            if (graph.updateTID) {
                graph.updateTID(
                    rotation.newRootKey,
                    rotation.direction === 'right' ? 't2' : 't6',
                );
            }
            graph.setNodeColor(rotation.newRootKey, colors.ROT_N);
            graph.setEdgeColor(
                rotation.pivotKey,
                rotation.newRootKey,
                colors.ROT_E,
            );

            startSplayRotationMovement(graph, rotation.pivotKey, rotation.newRootKey, rotation.direction);
        },
        [event],
        rotationDepth,
    );

    chunker.add(
        bookmarks.identifyTransfer,
        (vis, rotation) => {
            const graph = vis.graph;

            if (rotation.transferredSubtreeKey !== null) {
                if (graph.updateTID) {
                    graph.updateTID(rotation.transferredSubtreeKey, 't4');
                }
                graph.setNodeColor(
                    rotation.transferredSubtreeKey,
                    colors.ROT_N,
                );
            } else if (graph.setTagInfo) {
                graph.setTagInfo('t4 ');
            }
            moveSplayRotationPair(graph, rotation.pivotKey, rotation.newRootKey, 2);
        },
        [event],
        rotationDepth,
    );

    chunker.add(
        bookmarks.linkPivot,
        (vis, rotation) => {
            const graph = vis.graph;
            const {
                pivotKey,
                newRootKey,
                transferredSubtreeKey,
            } = rotation;

            graph.removeEdge(pivotKey, newRootKey);
            if (transferredSubtreeKey !== null) {
                graph.removeEdge(newRootKey, transferredSubtreeKey);
            }
            graph.addEdge(newRootKey, pivotKey);
            graph.setEdgeColor(newRootKey, pivotKey, colors.ROT_E);
            centerSplayRotatedRoot(graph, newRootKey);
        },
        [event],
        rotationDepth,
    );

    chunker.add(
        bookmarks.linkTransfer,
        (vis, rotation) => {
            if (rotation.transferredSubtreeKey !== null) {
                vis.graph.addEdge(
                    rotation.pivotKey,
                    rotation.transferredSubtreeKey,
                );
                vis.graph.setEdgeColor(
                    rotation.pivotKey,
                    rotation.transferredSubtreeKey,
                    colors.ROT_E,
                );
            }
            lowerSplayRotatedPivot(vis.graph, rotation.pivotKey);
        },
        [event],
        rotationDepth,
    );

    chunker.add(
        bookmarks.returnRoot,
        (vis, rotation, explicitRootKey) => {
            const graph = vis.graph;

            // The caller receives the new subtree root at this point. Update
            // its parent edge only now, matching the rotation pseudocode.
            if (rotation.parentKey !== null) {
                graph.removeEdge(rotation.parentKey, rotation.pivotKey);
                graph.addEdge(rotation.parentKey, rotation.newRootKey);
            }

            if (graph.setTagInfo) graph.setTagInfo('');
            graph.directed(true);
            graph.setMoveRatio(3 / 6);
            graph.setPauseLayout(false);
            graph.layoutAVL(explicitRootKey === null ? graph.getRoot() : explicitRootKey, true);
            if (graph.rectangle_size) graph.rectangle_size();
            graph.setFunctionName(
                isSplayDepthExpanded(operationType, [], mode)
                    ? `${caseLabel} — ${rotationName}`
                    : rotationName,
            );
            if (graph.setFunctionInsertText) {
                graph.setFunctionInsertText(` splayCase: ${caseLabel}`);
            }
        },
        [event, renderedRootKey],
        rotationDepth,
    );

    // Resume the Splay caller after the rotation has returned its subtree root.
    chunker.add(event.bookmark, () => {}, [event], event.depth);
}

// Register all primitive rotations for one Splay operation. A Zig-Zig or
// Zig-Zag case selects its case once, then reuses two left/right primitives.
// The rendered global root is advanced after each root-level rotation.
export function addSplayRotationChunks(
    chunker,
    events,
    operationType = 'insert',
    initialRenderedRootKey = null,
) {
    const rotationEvents = events.filter(event => event.type === 'rotation');
    const rotationsByDepth = countSplayRotationsByDepth(rotationEvents);
    const shownCaseDepths = new Set();
    let renderedRootKey = initialRenderedRootKey;

    rotationEvents.forEach(event => {
        if (event.parentKey === null) {
            renderedRootKey = event.newRootKey;
        }

        const includeCaseStep = !shownCaseDepths.has(event.depth);
        shownCaseDepths.add(event.depth);
        addSplayRotationChunk(
            chunker,
            event,
            operationType,
            rotationsByDepth[event.depth],
            renderedRootKey,
            includeCaseStep,
        );
    });

    return renderedRootKey;
}

// Register each call in execution order: caller preparation, callee body,
// then the caller's assignment. Collapsed blocks use these levels to skip
// the entire call, even though the Splay function itself is in Main.
function addSplayCallChunks(
    chunker, frames, searchPath, events, operationType, key, initialRootKey, mode,
) {
    const callFrames = frames.length > 0 ? frames : [{
        depth: 1,
        nodeKeys: [],
        recursionBlock: null,
        rootKey: null,
        splayCase: 'E',
    }];
    const rotationEvents = events.filter(event => event.type === 'rotation');
    const rotationsByDepth = countSplayRotationsByDepth(rotationEvents);
    const recursiveCalls = {
        LL: ['pre-recurseLL', 'recurse-LL'],
        LR: ['pre-recurseLR', 'recurseLR'],
        RR: ['pre-recurseRR', 'recurseRR'],
        RL: ['pre-recurseRL', 'recurse-RL'],
    };
    let renderedRootKey = initialRootKey;

    function resumeCaller(bookmark, depth, frame = null) {
        chunker.add(bookmark, (vis, callerDepth, caller, target) => {
            const graph = vis.graph;
            while (graph.rectangles && graph.rectangles.length > callerDepth) {
                graph.popRectStack();
            }
            if (graph.clearTID) graph.clearTID();
            if (graph.setTagInfo) graph.setTagInfo('');
            graph.setFunctionName(`${operationType === 'search' ? 'Search' : 'Insert'}: ${target}`);
            graph.setFunctionInsertText(caller
                ? ` splayCase: ${getSplayCaseLabel(caller.splayCase, rotationsByDepth[caller.depth] || 0)}`
                : undefined);
        }, [depth, frame, key], depth);
    }

    function visitCall(index) {
        const frame = callFrames[index];
        const { depth, splayCase } = frame;
        const recursionBlocks = callFrames.slice(0, index + 1)
            .map(call => call.recursionBlock).filter(Boolean);
        const rotationCount = rotationsByDepth[depth] || 0;

        chunker.add('splay-enter', (vis, currentFrame, target, count, blocks) => {
            const graph = vis.graph;
            if (graph.clearTID) graph.clearTID();
            graph.setFunctionName(`${operationType === 'search' ? 'Search' : 'Insert'}: ${target}`);
            graph.setFunctionInsertText();
            if (currentFrame.nodeKeys.length > 0) {
                addSplayDepthBox(graph, currentFrame, operationType, count, blocks, mode);
            }
        }, [frame, key, rotationCount, recursionBlocks], depth);

        const pathStart = searchPath.indexOf(frame.rootKey);
        const path = pathStart < 0 ? [] : searchPath.slice(pathStart, pathStart + 3);
        // Highlight only this call's first two edges, together in one step.
        // Keep call entry and depth-box creation at splay-enter above.
        chunker.add('switchPath', (vis, pathNodes, target) => {
            const graph = vis.graph;
            graph.nodes.forEach(({ id }) => graph.setNodeColor(id, undefined));
            graph.edges.forEach(({ source, target: child }) => {
                graph.setEdgeColor(source, child, undefined);
            });
            graph.setFunctionName(`${operationType === 'search' ? 'Search' : 'Insert'}: ${target}`);
            pathNodes.forEach((nodeKey, pathIndex) => {
                graph.setNodeColor(nodeKey, colors.PATH_N);
                if (pathIndex > 0) {
                    graph.setEdgeColor(pathNodes[pathIndex - 1], nodeKey, colors.PATH_E);
                }
            });
        }, [path, key], depth);
        chunker.add(getSplayCaseBookmark(splayCase), (vis, currentCase, count) => {
            vis.graph.setFunctionInsertText(` splayCase: ${getSplayCaseLabel(currentCase, count)}`);
        }, [splayCase, rotationCount], depth);

        if (index + 1 < callFrames.length) {
            const [prepare, returned] = recursiveCalls[splayCase];
            chunker.add(prepare, () => {}, [], depth);
            visitCall(index + 1);
            resumeCaller(returned, depth, frame);
        }

        if (splayCase === 'E') chunker.add('E-return', () => {}, [], depth);
        rotationEvents.filter(event => event.depth === depth).forEach(event => {
            if (event.parentKey === null) renderedRootKey = event.newRootKey;
            addSplayRotationChunk(
                chunker, event, operationType, rotationCount, renderedRootKey, false, mode,
            );
        });
        chunker.add('DoneSplay', () => {}, [], depth);
    }

    chunker.add(`pre-${operationType}-splay`, () => {}, [], 0);
    visitCall(0);
    resumeCaller(`${operationType}-splay-call`, 0);
}

function getSplayInsertionMessage(event) {
    switch (event.action) {
        case 'empty-tree':
            return `Insert ${event.key} into the empty tree`;
        case 'insert-left':
            return `Insert ${event.key} above and left of ${event.rootKey}`;
        case 'insert-right':
            return `Insert ${event.key} above and right of ${event.rootKey}`;
        case 'duplicate':
            return `Duplicate ignored: ${event.key}`;
        default:
            return `Insert: ${event.key}`;
    }
}

// Show the insertion decision at its caller-level condition/comment. Keep
// function-entry bookmarks reserved for the start of each operation.
function addSplayInsertionBranchChunk(chunker, event) {
    const bookmark = {
        'empty-tree': 'insert-test-empty',
        'insert-left': 'insert-test-left',
        'insert-right': 'insert-test-right',
        duplicate: 'insert-duplicate',
    }[event.action];
    chunker.add(
        bookmark,
        (vis, insertion) => {
            const graph = vis.graph;
            if (graph.clearTID) graph.clearTID();

            graph.nodes.forEach(({ id }) => {
                graph.setNodeColor(id, undefined);
            });
            graph.edges.forEach(({ source, target }) => {
                graph.setEdgeColor(source, target, undefined);
            });

            if (insertion.rootKey !== null) {
                const rootColor = insertion.action === 'duplicate'
                    ? colors.FOUND_N
                    : colors.PATH_N;
                graph.setNodeColor(insertion.rootKey, rootColor);
            }

            graph.setFunctionName(getSplayInsertionMessage(insertion));
            graph.setFunctionInsertText();
        },
        [event],
        0,
    );
}

// Ensure three additional steps of animation within splay tree is registered
function addSplayInsertionSteps(chunker, event, leftKey, rightKey) {
    if (event.action !== 'insert-left' && event.action !== 'insert-right') return;

    const bookmark = event.action;
    const detachedKey = event.action === 'insert-left' ? leftKey : rightKey;

    chunker.add(`${bookmark}-save`, (vis, left, right) => {
        const graph = vis.graph;

        graph.clearTID();

        if (left !== null) {
            graph.updateTID(left, 'l');
            graph.setNodeColor(left, colors.PATH_N);
        }

        if (right !== null) {
            graph.updateTID(right, 'r');
            graph.setNodeColor(right, colors.PATH_N);
        }

        graph.rectangle_size();
    }, [leftKey, rightKey], 0);

    chunker.add(`${bookmark}-detach`, (vis, oldRoot, detached) => {
        const graph = vis.graph;

        graph.setPauseLayout(true);

        if (detached !== null) {
            graph.removeEdge(oldRoot, detached);
        }

        graph.rectangle_size();
    }, [event.rootKey, detachedKey], 0);

    chunker.add(`${bookmark}-create`, (vis, insertedKey, left, right) => {
        const graph = vis.graph;

        graph.setPauseLayout(true);
        graph.addNode(insertedKey, insertedKey);

        if (left !== null) {
            graph.addEdge(insertedKey, left);
        }

        if (right !== null) {
            graph.addEdge(insertedKey, right);
        }

        graph.clearTID();

        graph.nodes.forEach(({ id }) => {
            graph.setNodeColor(id, undefined);
        });

        graph.edges.forEach(({ source, target }) => {
            graph.setEdgeColor(source, target, undefined);
        });

        graph.setNodeColor(insertedKey, colors.NEW_N);
        graph.directed(true);
        graph.setMoveRatio(1);
        graph.setPauseLayout(false);
        graph.layoutAVL(insertedKey, true);
        graph.rectangle_size();
    }, [event.key, leftKey, rightKey], 0);
}

function addSplaySearchSnapshotChunk(chunker, root, target) {
    if (root === null) {
        chunker.add(
            'search-return-not-found',
            (vis, searchedKey) => {
                if (vis.graph.clearRectangles) vis.graph.clearRectangles();
                if (vis.graph.clearTID) vis.graph.clearTID();
                vis.graph.setFunctionName(`Not found: ${searchedKey}`);
                vis.graph.setFunctionInsertText();
            },
            [target],
            0,
        );
        return;
    }

    const {
        nodeKeys,
        edges,
        rootKey,
    } = createSplaySnapshot(root);
    const found = rootKey === target;

    chunker.add(
        found ? 'search-return-found' : 'search-return-not-found',
        (vis, keys, treeEdges, snapshotRoot, searchedKey, isFound) => {
            const graph = vis.graph;
            if (graph.clearRectangles) graph.clearRectangles();
            if (graph.clearTID) graph.clearTID();

            graph.setPauseLayout(true);
            [...graph.edges].forEach(({ source, target: child }) => {
                graph.removeEdge(source, child);
            });
            keys.forEach(nodeKey => {
                graph.addNode(nodeKey, nodeKey);
                graph.setNodeColor(nodeKey, undefined);
            });
            treeEdges.forEach(([parent, child]) => {
                graph.addEdge(parent, child);
            });

            graph.directed(true);
            graph.setPauseLayout(false);
            graph.root = snapshotRoot;
            graph.rectangle_size();
            graph.setNodeColor(
                searchedKey,
                isFound ? colors.FOUND_N : colors.PATH_N,
            );
            graph.setFunctionName(
                isFound ? `Found: ${searchedKey}` : `Not found: ${searchedKey}`,
            );
            graph.setFunctionInsertText();
        },
        [nodeKeys, edges, rootKey, target, found],
        0,
    );
}

// XXX interface currently uses true/false/'splay' to select a tree type;
// consider replacing it with named options in a future refactor.
// default is recursive BST insertion 
// If isAVL = true we have recursive AVLT insertion
// If isInsert = true 
export function createTreeInsertionController(isAVLp = false) {
    const isSplayController = (isAVLp === 'splay');
    // const treeType = isAVL ? 'AVL' : 'BST'; // no longer used
    // const functionPrefix = isAVL ? 'AVLT' : 'BST';
    return {
        // visualiser used only for insert
        initVisualisers({ visualiser }) {
            isAVL = (isAVLp === true);
            return {
                graph: {
                    // XXX specialise "Tree" label???
                    instance: new GraphTracer(isAVL ? 'avl' : 'bst', null, `Tree`),
                    order: 1,
                },
             }
        },


        /**
        *
        * @param {object} chunker object to handle the execution of visualisation
        * @param {array} nodes array of numbers needs to be inserted
        */
        // nodes used for insert; visualiser and target used for search
        run(chunker, {
            nodes = [],
            operations,
            visualiser,
            target,
            mode = 'operations',
        }) {
            isInsert = true;
            const operationList = isSplayController
                ? (
                    Array.isArray(operations)
                        ? operations
                        : nodes.map(value => ({
                            type: 'insert',
                            value,
                        }))
                )
                : nodes;

            if (operationList.length === 0) return;

            // Splay initializes its visualisation at the first operation's
            // entry. Other tree controllers retain their existing setup step.
            if (!isSplayController) {
                chunker.add(
                    'Main',
                    (vis) => {
                        vis.graph.isWeighted = isAVL;
                        vis.graph.setFunctionName('Tree is Empty');
                        vis.graph.setPauseLayout(false);
                        vis.graph.setMoveRatio(1);
                        vis.graph.setSize(1.2);
                        vis.graph.setZoom(0.5);
                    },
                    [],
                    1
                );
            }
            // Splay insertion stays in the pure data structure. Visual updates
            // are connected incrementally after the algorithm call is verified.
            if (isSplayController) {
                let root = null;

                operationList.forEach((operation, operationIndex) => {
                    const { type, value: key } = operation;

                    if (!Number.isInteger(key)) {
                        throw new Error(
                            `Invalid Splay Tree key: ${String(key)}`,
                        );
                    }

                    if (type !== 'insert' && type !== 'search') {
                        throw new Error(
                            `Unknown Splay Tree operation: ${String(type)}`,
                        );
                    }

                    chunker.add(
                        type === 'search' ? '1' : 'Main',
                        (vis, operationType, currentKey, initialize) => {
                            const graph = vis.graph;
                            if (initialize) {
                                graph.isWeighted = false;
                                graph.setPauseLayout(false);
                                graph.setMoveRatio(1);
                                graph.setSize(1.2);
                                graph.setZoom(0.5);
                            }
                            if (graph.clearRectangles) graph.clearRectangles();
                            if (graph.clearTID) graph.clearTID();
                            if (graph.setTagInfo) graph.setTagInfo('');
                            graph.nodes.forEach(({ id }) => {
                                graph.setNodeColor(id, undefined);
                            });
                            graph.edges.forEach(({ source, target: child }) => {
                                graph.setEdgeColor(source, child, undefined);
                            });
                            graph.setFunctionName(
                                `${operationType === 'search' ? 'Search' : 'Insert'}: ${currentKey}`,
                            );
                            graph.setFunctionInsertText();
                        },
                        [type, key, operationIndex === 0],
                        0,
                    );

                    if (type === 'search') {
                        const searchPath = getSplayTreePath(root, key);
                        const recursionFrames = getSplayRecursionFrames(root, key);
                        const initialRootKey = root === null ? null : root.key;
                        const algorithmEvents = [];
                        root = SplayTree.search(
                            root,
                            key,
                            event => algorithmEvents.push(event),
                        );
                        addSplayCallChunks(
                            chunker, recursionFrames, searchPath, algorithmEvents,
                            'search', key, initialRootKey, mode,
                        );
                        addSplaySearchSnapshotChunk(chunker, root, key);
                        return;
                    }

                    const searchPath = getSplayTreePath(root, key);
                    const recursionFrames = getSplayRecursionFrames(root, key);
                    const initialRootKey = root === null ? null : root.key;
                    const algorithmEvents = [];
                    root = SplayTree.insert(
                        root,
                        key,
                        event => algorithmEvents.push(event),
                    );
                    // An empty-tree insertion returns before calling Splay.
                    if (searchPath.length > 0) {
                        addSplayCallChunks(
                            chunker, recursionFrames, searchPath, algorithmEvents,
                            'insert', key, initialRootKey, mode,
                        );
                    }
                    algorithmEvents
                        .filter(event => event.type === 'insertion')
                        .forEach(event => {
                            addSplayInsertionBranchChunk(chunker, event);
                            addSplayInsertionSteps(chunker, event, root.left === null ? null : root.left.key, root.right === null ? null : root.right.key);
                        });
                    const insertionEvent = algorithmEvents.find(
                        event => event.type === 'insertion',
                    );

                    const {
                        nodeKeys,
                        edges,
                        rootKey,
                    } = createSplaySnapshot(root);

                    chunker.add(insertionEvent.action === 'empty-tree' ? 'insert-return-empty' : 'insert-return', (vis, snapshotRoot, insertedKey, insertion) => {
                        const graph = vis.graph;

                        if (graph.clearRectangles) graph.clearRectangles();
                        if (graph.clearTID) graph.clearTID();

                        if (insertion.action === 'empty-tree') {
                            graph.setPauseLayout(true);
                            graph.addNode(insertedKey, insertedKey);
                            graph.directed(true);
                            graph.setMoveRatio(1);
                            graph.setPauseLayout(false);
                            graph.layoutAVL(snapshotRoot, true);
                        }

                        graph.nodes.forEach(({ id }) => {
                            graph.setNodeColor(id, undefined);
                        });

                        graph.edges.forEach(({ source, target }) => {
                            graph.setEdgeColor(source, target, undefined);
                        });

                        graph.root = snapshotRoot;
                        graph.rectangle_size();

                        const rootColor = insertion.action === 'duplicate' ? colors.FOUND_N : colors.NEW_N;

                        graph.setNodeColor(snapshotRoot, rootColor);
                        graph.setFunctionName(insertion.action === 'duplicate' ? getSplayInsertionMessage(insertion) : `Inserted: ${insertedKey}`);
                        graph.setFunctionInsertText();
                    }, [root.key, key, insertionEvent], 0);
                });

                return root;
            }

            // initialise the first key insertion
            // We now skip boxes etc even when recursion is expanded and
            // don't highlight new node (otherwise an extra chunk is
            // needed and there are already more than enough for such a
            // conceptually simple case)
            chunker.add(
                `Main`,
                (vis, elements, k) => {
                    // Set initial function information
                    vis.graph.setFunctionName(`Insert: ${k}`);
                    vis.graph.setFunctionInsertText();
                    // initialise the tree with the first key with box
/*
                    vis.graph.addNode(k, k);
                    if (isAVL) {
                        vis.graph.updateHeight(k, 1);
                    }
                    vis.graph.layoutAVL(k, true, false);
                   
                    if (isRecursionExpanded()) {
                        // Pause the layout then remove the node, keep the rectangle
                        vis.graph.pushRectStack([k], `Depth 1`);
                        vis.graph.pushRectStack([], 'Empty');
                        vis.graph.rectangle_size();
                    }
                    vis.graph.setPauseLayout(true);
                    vis.graph.removeNode(k);
*/
                },
                [nodes, nodes[0], nodes[0].parentNode],
                1
            );

            // empty second chunker
            chunker.add('if t = Empty', (vis) => null, [], 1)

            // Insert the first key into the rectangle
            chunker.add('return n',
                (vis, k) => {
                    vis.graph.addNode(k, k);
                    if (isAVL) {
                        vis.graph.updateHeight(k, 1);
                    }
                    vis.graph.layoutAVL(k, true, false);
                },
                [nodes[0]],
                1
            );
            chunker.add(
                `Done`,
                (vis, k) => {
                    vis.graph.setFunctionName(`Inserted: ${k}`);
                    vis.graph.setFunctionInsertText();
                },
                [nodes[0]],
                1
            );

            // store the global root node
            globalRoot = new TreeNode(nodes[0]);

            // insert the rest of the keys into the tree
            // - this builds a recursive tree structure
            // (maybe we could start with the empty tree and get rid
            // of the code for the first node above)
            for (let i = 1; i < nodes.length; i++) {
                globalRoot = insertOrSearch(chunker, globalRoot, nodes[i], i);
            }
            // finalise the visualisation
            chunker.add(`Main`,
                vis => {
                    vis.graph.setFunctionName("Finished");
                    vis.graph.setFunctionInsertText();
                    if (isAVL) {
                        vis.graph.setFunctionNode(null);
                        vis.graph.setFunctionBalance(null);
                        // vis.graph.clearSelect_Circle_Count();
                    }
                    vis.graph.clearRectangles();
                },
                [],
                1
            );
            return globalRoot;
        }
    };
}

// If isAVL = true we have recursive AVLT search (NOT USED/TESTED)
// NOTE: we currently only use this code for BSTRec search
// AVLT search uses iterative BST search
export function createTreeSearchController(isAVLp = false) {
    // const treeType = isAVL ? 'AVL' : 'BST'; // no longer used
    // const functionPrefix = isAVL ? 'AVLT' : 'BST';
    return {
        // visualiser used only for insert
        initVisualisers({ visualiser }) {
            isAVL = isAVLp;
            // clear existing trace, if any
            graph_clear(visualiser.graph);
            return {
                graph: {
                    instance: visualiser.graph.instance,
                    order: 0,
                },
            }
        },


        /**
        *
        * @param {object} chunker object to handle the execution of visualisation
        * @param {array} nodes array of numbers needs to be inserted
        */
        // nodes used for insert; visualiser and target used for search
        run(chunker, { visualiser, target }) {

            isInsert = false;
            // get whole tree from the visualiser
            const flatTree = visualiser.graph.instance.getTree();
            let rootKey = visualiser.graph.instance.getRoot();

            globalRoot = new TreeNode(rootKey);
            treeFromFlatTree(globalRoot, flatTree);

            let current = rootKey;
            let parent = null;

            chunker.add('Main', (vis, c, r) => {
                // vis.graph.setZoom(0.55);
                // Remove all the recursion rectangles first
                vis.graph.popAllRectStack();
                vis.graph.setPauseLayout(false);
                vis.graph.setFunctionName(`Search: ${target}`);
                vis.graph.setFunctionInsertText();
                uncolor(vis.graph, r);
            }, [current, globalRoot], 1);
            let r = insertOrSearch(chunker, globalRoot, target, 0);
        }
    };
}

export default createTreeInsertionController(false);

export const AVLTreeInsertion = createTreeInsertionController(true);
export const BSTreeSearch = createTreeSearchController(false);
