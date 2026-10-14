// Splay tree implementation
// (XXX should add deletion?)
// Needs extra augmentation to make it into an AIA controller for
// animation (best merge AVL tree controller with this code as we want
// animations to be similar)

// The code is contributed by Nidhi goel to Geeks for Geeks
// Modified by Lee Naish

// Javascript code addition 

/**
 * Pure Splay Tree data structure used by the AIA controllers.
 *
 * This module deliberately contains no visualisation code. Controllers can
 * build animation chunks around these operations while the data-structure
 * behaviour remains independently testable.
 */

export class Node {
  constructor(key) {
    this.key = key;
    this.left = null;
    this.right = null;
  }
}

class SplayTree {
  static newNode(key) {
    return new Node(key);
  }

  static reportInsertion(onEvent, action, key, rootKey) {
    if (onEvent) {
      onEvent({
        type: 'insertion',
        action,
        bookmark: 'Main',
        key,
        rootKey,
      });
    }
  }

  static rightRotate(root) {
    const newRoot = root.left;
    root.left = newRoot.right;
    newRoot.right = root;
    return newRoot;
  }

  static leftRotate(root) {
    const newRoot = root.right;
    root.right = newRoot.left;
    newRoot.left = root;
    return newRoot;
  }

  static rightRotateWithEvent(root, onEvent, eventDetails) {
    const pivotKey = root.key;
    const newRootKey = root.left.key;
    const transferredSubtreeKey = root.left.right === null
      ? null
      : root.left.right.key;
    const newRoot = SplayTree.rightRotate(root);

    if (onEvent) {
      onEvent({
        type: 'rotation',
        direction: 'right',
        ...eventDetails,
        pivotKey,
        newRootKey,
        transferredSubtreeKey,
      });
    }

    return newRoot;
  }

  static leftRotateWithEvent(root, onEvent, eventDetails) {
    const pivotKey = root.key;
    const newRootKey = root.right.key;
    const transferredSubtreeKey = root.right.left === null
      ? null
      : root.right.left.key;
    const newRoot = SplayTree.leftRotate(root);

    if (onEvent) {
      onEvent({
        type: 'rotation',
        direction: 'left',
        ...eventDetails,
        pivotKey,
        newRootKey,
        transferredSubtreeKey,
      });
    }

    return newRoot;
  }

  /**
   * Move the requested key, or the last node reached while looking for it,
   * to the root of the tree.
   *
   * The recursive structure follows the existing AIA pseudocode: it examines
   * two levels at a time and performs rotations as recursive calls return.
   */
  static splay(root, key, onEvent = null, parentKey = null, depth = 1) {
    if (root === null || root.key === key) {
      return root;
    }

    if (key < root.key) {
      if (root.left === null) {
        return root;
      }

      let splayCase = 'LE';

      // Two-edge cases require the second edge to exist. A missing
      // grandchild is Left-Empty, just like finding k at the left child.
      if (key < root.left.key && root.left.left !== null) {
        splayCase = 'LL';
        // Left-left: first splay inside the left-left subtree.
        root.left.left = SplayTree.splay(
          root.left.left,
          key,
          onEvent,
          root.left.key,
          depth + 1,
        );
        root = SplayTree.rightRotateWithEvent(root, onEvent, {
          bookmark: 'LL-rot1',
          splayCase,
          parentKey,
          depth,
        });
      } else if (key > root.left.key && root.left.right !== null) {
        splayCase = 'LR';
        // Left-right: first splay inside the left-right subtree.
        root.left.right = SplayTree.splay(
          root.left.right,
          key,
          onEvent,
          root.left.key,
          depth + 1,
        );
        if (root.left.right !== null) {
          root.left = SplayTree.leftRotateWithEvent(root.left, onEvent, {
            bookmark: 'LR-rot1',
            splayCase,
            parentKey: root.key,
            depth,
          });
        }
      }

      // This is also the single-rotation case when the key is the left child.
      if (root.left === null) return root;

      return SplayTree.rightRotateWithEvent(root, onEvent, {
        bookmark: splayCase === 'LE' ? 'LE-rot1' : `${splayCase}-rot2`,
        splayCase,
        parentKey,
        depth,
      });
    }

    if (root.right === null) {
      return root;
    }

    let splayCase = 'RE';

    // Mirror the Left-Empty rule when the requested right grandchild is absent.
    if (key > root.right.key && root.right.right !== null) {
      splayCase = 'RR';
      // Right-right: first splay inside the right-right subtree.
      root.right.right = SplayTree.splay(
        root.right.right,
        key,
        onEvent,
        root.right.key,
        depth + 1,
      );
      root = SplayTree.leftRotateWithEvent(root, onEvent, {
        bookmark: 'RR-rot1',
        splayCase,
        parentKey,
        depth,
      });
    } else if (key < root.right.key && root.right.left !== null) {
      splayCase = 'RL';
      // Right-left: first splay inside the right-left subtree.
      root.right.left = SplayTree.splay(
        root.right.left,
        key,
        onEvent,
        root.right.key,
        depth + 1,
      );
      if (root.right.left !== null) {
        root.right = SplayTree.rightRotateWithEvent(root.right, onEvent, {
          bookmark: 'RL-rot1',
          splayCase,
          parentKey: root.key,
          depth,
        });
      }
    }

    // This is also the single-rotation case when the key is the right child.
    if (root.right === null) return root;

    return SplayTree.leftRotateWithEvent(root, onEvent, {
      bookmark: splayCase === 'RE' ? 'RE-rot1' : `${splayCase}-rot2`,
      splayCase,
      parentKey,
      depth,
    });
  }

  static search(root, key, onEvent = null) {
    return SplayTree.splay(root, key, onEvent);
  }

  static insert(root, key, onEvent = null) {
    if (root === null) {
      SplayTree.reportInsertion(onEvent, 'empty-tree', key, null);
      return SplayTree.newNode(key);
    }

    const splayedRoot = SplayTree.splay(root, key, onEvent);

    // Duplicate keys are ignored. Splaying still moves the existing node to
    // the root, which is the expected Splay Tree access behaviour.
    if (splayedRoot.key === key) {
      SplayTree.reportInsertion(
        onEvent,
        'duplicate',
        key,
        splayedRoot.key,
      );
      return splayedRoot;
    }

    const newRoot = SplayTree.newNode(key);

    if (key < splayedRoot.key) {
      SplayTree.reportInsertion(
        onEvent,
        'insert-left',
        key,
        splayedRoot.key,
      );
      newRoot.left = splayedRoot.left;
      newRoot.right = splayedRoot;
      splayedRoot.left = null;
    } else {
      SplayTree.reportInsertion(
        onEvent,
        'insert-right',
        key,
        splayedRoot.key,
      );
      newRoot.left = splayedRoot;
      newRoot.right = splayedRoot.right;
      splayedRoot.right = null;
    }

    return newRoot;
  }

  /**
   * Delete key from the tree and return the resulting root.
   * If key is absent, splay still moves the closest accessed node to the
   * root. When key is present, the maximum node in its left subtree becomes
   * the new root before the original right subtree is reattached.
   */
  static delete(root, key, onEvent = null) {
    if (root === null) return root;

    const splayedRoot = SplayTree.splay(root, key, onEvent);

    if (splayedRoot.key !== key) return splayedRoot;
    if (splayedRoot.left === null) return splayedRoot.right;

    const rightSubtree = splayedRoot.right;
    const newRoot = SplayTree.splay(splayedRoot.left, key, onEvent);
    newRoot.right = rightSubtree;

    return newRoot;
  }
}

export default SplayTree;
