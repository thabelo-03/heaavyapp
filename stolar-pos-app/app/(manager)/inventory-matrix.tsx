import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { API_BASE_URL } from '../config';

// Interfaces for our data
interface Product {
  _id: string;
  name: string;
  stockQuantity: number;
  price: number;
  shopId: string;
}

interface Shop {
  _id: string;
  name: string;
}

interface MatrixData {
  shopNames: string[];
  productNames: string[];
  matrix: { [shopName: string]: { [productName: string]: number } };
  rowTotals: { [shopName: string]: number };
  colTotals: { [productName: string]: number };
  grandTotal: number;
  priceMap: Map<string, number>;
  valueTotals: { [productName: string]: number };
  grandValueTotal: number;
}

// Main Component
export default function InventoryMatrixScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);

  const processInventoryData = (products: Product[], shops: Shop[]): MatrixData => {
    const productNames = [...new Set(products.map(p => p.name))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const shopMap = new Map(shops.map(s => [s._id, s.name]));
    const shopNames = [...shopMap.values()].sort();
    const priceMap = new Map<string, number>();
    products.forEach(p => {
      if (!priceMap.has(p.name)) {
        priceMap.set(p.name, p.price);
      }
    });

    const matrix: { [shopName: string]: { [productName: string]: number } } = {};
    shopNames.forEach(shopName => {
      matrix[shopName] = {};
      productNames.forEach(productName => {
        matrix[shopName][productName] = 0;
      });
    });

    products.forEach(product => {
      const shopName = shopMap.get(product.shopId);
      if (shopName && productNames.includes(product.name)) {
        matrix[shopName][product.name] = product.stockQuantity;
      }
    });

    const rowTotals: { [shopName: string]: number } = {};
    shopNames.forEach(shopName => {
      rowTotals[shopName] = productNames.reduce((sum, productName) => sum + (matrix[shopName][productName] || 0), 0);
    });

    const colTotals: { [productName: string]: number } = {};
    productNames.forEach(productName => {
      colTotals[productName] = shopNames.reduce((sum, shopName) => sum + (matrix[shopName][productName] || 0), 0);
    });

    const grandTotal = Object.values(colTotals).reduce((sum, val) => sum + val, 0);

    const valueTotals: { [productName: string]: number } = {};
    productNames.forEach(productName => {
      valueTotals[productName] = (colTotals[productName] || 0) * (priceMap.get(productName) || 0);
    });

    const grandValueTotal = Object.values(valueTotals).reduce((sum, val) => sum + val, 0);

    return { shopNames, productNames, matrix, rowTotals, colTotals, grandTotal, priceMap, valueTotals, grandValueTotal };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        router.replace('/(auth)/login');
        return;
      }

      const shopsRes = await fetch(`${API_BASE_URL}/shops?managerId=${userId}`);
      const shops: Shop[] = await shopsRes.json();

      if (shops.length > 0) {
        const productsRes = await fetch(`${API_BASE_URL}/products`);
        let allProducts: Product[] = await productsRes.json();
        
        const managedShopIds = new Set(shops.map(s => s._id));
        const relevantProducts = allProducts.filter(p => managedShopIds.has(p.shopId));

        const data = processInventoryData(relevantProducts, shops);
        setMatrixData(data);
      }
    } catch (error) {
      console.error("Failed to fetch inventory data:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const formatNumber = (num: number) => num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1e40af" /></View>;
  }

  if (!matrixData || matrixData.shopNames.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Inventory Matrix</Text>
        </View>
        <View style={styles.center}>
          <Text>No inventory data found for your shops.</Text>
        </View>
      </View>
    );
  }

  const { shopNames, productNames, matrix, rowTotals, colTotals, grandTotal, priceMap, valueTotals, grandValueTotal } = matrixData;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inventory Matrix</Text>
      </View>

      <ScrollView>
        <ScrollView horizontal bounces={false}>
          <View style={styles.table}>
            {/* Header Row */}
            <View style={styles.row}>
              <Text style={[styles.cell, styles.headerCell, styles.fixedCol]}>BRANCH</Text>
              {productNames.map(name => <Text key={name} style={[styles.cell, styles.headerCell]}>{name}</Text>)}
              <Text style={[styles.cell, styles.headerCell, styles.totalCol]}>TOTAL</Text>
            </View>

            {/* Data Rows */}
            {shopNames.map(shopName => (
              <View key={shopName} style={styles.row}>
                <Text style={[styles.cell, styles.fixedCol, styles.shopNameCell]}>{shopName}</Text>
                {productNames.map(productName => (
                  <Text key={`${shopName}-${productName}`} style={styles.cell}>
                    {matrix[shopName][productName] || 0}
                  </Text>
                ))}
                <Text style={[styles.cell, styles.totalCol, styles.rowTotalCell]}>{rowTotals[shopName] || 0}</Text>
              </View>
            ))}

            {/* Totals Row */}
            <View style={[styles.row, styles.footerRow]}>
              <Text style={[styles.cell, styles.headerCell, styles.fixedCol]}>TOTAL</Text>
              {productNames.map(name => (
                <Text key={`total-${name}`} style={[styles.cell, styles.headerCell]}>
                  {colTotals[name] || 0}
                </Text>
              ))}
              <Text style={[styles.cell, styles.headerCell, styles.totalCol]}>{grandTotal}</Text>
            </View>

            {/* Selling Price Row */}
            <View style={[styles.row, styles.footerRow]}>
              <Text style={[styles.cell, styles.headerCell, styles.fixedCol]}>Selling Price</Text>
              {productNames.map(name => (
                <Text key={`price-${name}`} style={[styles.cell, styles.headerCell, styles.priceCell]}>
                  ${(priceMap.get(name) || 0).toFixed(2)}
                </Text>
              ))}
              <Text style={[styles.cell, styles.headerCell, styles.totalCol]}></Text>
            </View>

            {/* Total Value Row */}
            <View style={[styles.row, styles.footerRow]}>
              <Text style={[styles.cell, styles.headerCell, styles.fixedCol]}>Total Value</Text>
              {productNames.map(name => (
                <Text key={`value-${name}`} style={[styles.cell, styles.headerCell, styles.priceCell]}>
                  ${formatNumber(valueTotals[name] || 0)}
                </Text>
              ))}
              <Text style={[styles.cell, styles.headerCell, styles.totalCol]}>
                ${formatNumber(grandValueTotal)}
              </Text>
            </View>
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    backgroundColor: '#1e3a8a',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { marginRight: 15, padding: 5 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  table: { padding: 10 },
  row: { flexDirection: 'row' },
  cell: {
    minWidth: 80,
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderWidth: 0.5,
    borderColor: '#e2e8f0',
    textAlign: 'center',
    fontSize: 12,
    backgroundColor: 'white',
  },
  headerCell: {
    backgroundColor: '#f1f5f9',
    fontWeight: 'bold',
    color: '#475569',
  },
  fixedCol: {
    minWidth: 120,
    backgroundColor: '#f8fafc',
    fontWeight: 'bold',
    textAlign: 'left',
    paddingLeft: 10,
  },
  shopNameCell: {
    fontSize: 11,
  },
  totalCol: {
    minWidth: 90,
    backgroundColor: '#eff6ff',
    fontWeight: 'bold',
    color: '#1e40af',
  },
  rowTotalCell: {
    backgroundColor: '#f1f5f9',
    fontWeight: 'bold',
  },
  footerRow: {
    borderTopWidth: 2,
    borderTopColor: '#94a3b8',
  },
  priceCell: {
    color: '#059669',
  },
});