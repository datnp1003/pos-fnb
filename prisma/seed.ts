import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log("🌱 Seeding POS F&B...\n");

  // ========== CURRENCIES ==========
  await db.currency.upsert({ where: { code: "BRL" }, update: {}, create: { code: "BRL", name: "Brazilian Real", symbol: "R$", rate: 1, isDefault: true, sortOrder: 1 } });
  await db.currency.upsert({ where: { code: "USD" }, update: {}, create: { code: "USD", name: "US Dollar", symbol: "$", rate: 0.18, isDefault: false, sortOrder: 2 } });
  await db.currency.upsert({ where: { code: "EUR" }, update: {}, create: { code: "EUR", name: "Euro", symbol: "€", rate: 0.16, isDefault: false, sortOrder: 3 } });
  console.log("✅ Currencies");

  // ========== ROLES ==========
  const adminRole = await db.role.upsert({ where: { name: "Admin" }, update: {}, create: { name: "Admin", permissions: JSON.stringify(["*"]), scopes: JSON.stringify(["*"]) } });
  await db.role.upsert({ where: { name: "Manager" }, update: {}, create: { name: "Manager", permissions: JSON.stringify(["reports.view","settings.*","inventory.*","cash.view"]), scopes: JSON.stringify(["reports","settings","inventory","cash"]) } });
  await db.role.upsert({ where: { name: "Cashier" }, update: {}, create: { name: "Cashier", permissions: JSON.stringify(["order.*","payments.*"]), scopes: JSON.stringify(["order","cash"]) } });
  await db.role.upsert({ where: { name: "Waiter" }, update: {}, create: { name: "Waiter", permissions: JSON.stringify(["order.open","order.item_add","order.send"]), scopes: JSON.stringify(["order"]) } });
  console.log("✅ Roles");

  // ========== USERS ==========
  const hashPwd = await hash("admin123", 12);
  await db.user.upsert({ where: { username: "admin" }, update: {}, create: { username: "admin", password: hashPwd, name: "Admin", roleId: adminRole.id } });
  await db.user.upsert({ where: { username: "cashier1" }, update: {}, create: { username: "cashier1", password: hashPwd, name: "Cashier 1", roleId: (await db.role.findUniqueOrThrow({ where: { name: "Cashier" } })).id } });
  await db.user.upsert({ where: { username: "waiter1" }, update: {}, create: { username: "waiter1", password: hashPwd, name: "Waiter 1", roleId: (await db.role.findUniqueOrThrow({ where: { name: "Waiter" } })).id } });
  console.log("✅ Users (admin, cashier1, waiter1 / admin123)");

  // ========== GENERAL CONFIG ==========
  await db.generalConfig.upsert({ where: { id: "default" }, update: {}, create: { restaurantName: "My Restaurant", address: "123 Main Street", phone: "11999999999", currencyCode: "BRL" } });
  console.log("✅ Config");

  // ========== VAT ==========
  await db.vat.upsert({ where: { code: "VAT5" }, update: {}, create: { code: "VAT5", name: "VAT 5%", rate: 0.05 } });
  const vat8 = await db.vat.upsert({ where: { code: "VAT8" }, update: {}, create: { code: "VAT8", name: "VAT 8%", rate: 0.08 } });
  const vat10 = await db.vat.upsert({ where: { code: "VAT10" }, update: {}, create: { code: "VAT10", name: "VAT 10%", rate: 0.10 } });
  console.log("✅ VAT (5%, 8%, 10%)");

  // ========== EXCISE TAX ==========
  await db.exciseTax.upsert({ where: { code: "NONE" }, update: {}, create: { code: "NONE", name: "Not Applicable", rate: 0 } });
  const exciseBeer = await db.exciseTax.upsert({ where: { code: "BEER" }, update: {}, create: { code: "BEER", name: "Alcoholic Beverages", rate: 0.65 } });
  await db.exciseTax.upsert({ where: { code: "TOBACCO" }, update: {}, create: { code: "TOBACCO", name: "Tobacco", rate: 0.75 } });
  console.log("✅ Excise Tax");

  // ========== UNITS ==========
  const uServing = await db.unit.upsert({ where: { name: "Serving" }, update: {}, create: { name: "Serving" } });
  const uGlass = await db.unit.upsert({ where: { name: "Glass" }, update: {}, create: { name: "Glass" } });
  const uBottle = await db.unit.upsert({ where: { name: "Bottle" }, update: {}, create: { name: "Bottle" } });
  const uCan = await db.unit.upsert({ where: { name: "Can" }, update: {}, create: { name: "Can" } });
  const uPlate = await db.unit.upsert({ where: { name: "Plate" }, update: {}, create: { name: "Plate" } });
  const uBowl = await db.unit.upsert({ where: { name: "Bowl" }, update: {}, create: { name: "Bowl" } });
  const uPiece = await db.unit.upsert({ where: { name: "Piece" }, update: {}, create: { name: "Piece" } });
  // Ingredient units
  await db.unit.upsert({ where: { name: "Kg" }, update: {}, create: { name: "Kg" } });
  const uGram = await db.unit.upsert({ where: { name: "Gram" }, update: {}, create: { name: "Gram" } });
  const uMl = await db.unit.upsert({ where: { name: "Ml" }, update: {}, create: { name: "Ml" } });
  await db.unit.upsert({ where: { name: "Liter" }, update: {}, create: { name: "Liter" } });
  console.log("✅ Units");

  // ========== CATEGORIES ==========
  const catMain = await db.category.upsert({ where: { slug: "main-course" }, update: {}, create: { name: "Main Course", slug: "main-course", sortOrder: 1 } });
  const catDrink = await db.category.upsert({ where: { slug: "beverages" }, update: {}, create: { name: "Beverages", slug: "beverages", sortOrder: 2 } });
  const catStarter = await db.category.upsert({ where: { slug: "starters" }, update: {}, create: { name: "Starters", slug: "starters", sortOrder: 3 } });
  const catDessert = await db.category.upsert({ where: { slug: "desserts" }, update: {}, create: { name: "Desserts", slug: "desserts", sortOrder: 4 } });
  const catBeer = await db.category.upsert({ where: { slug: "beer-wine" }, update: {}, create: { name: "Beer & Wine", slug: "beer-wine", sortOrder: 5 } });
  const catCoffee = await db.category.upsert({ where: { slug: "coffee" }, update: {}, create: { name: "Coffee", slug: "coffee", sortOrder: 6 } });
  const catGrill = await db.category.upsert({ where: { slug: "grill-hotpot" }, update: {}, create: { name: "Grill & Hotpot", slug: "grill-hotpot", sortOrder: 7 } });
  console.log("✅ Categories (7)");

  // ========== PRODUCTS ==========
  const products = await Promise.all([
    // Main Course
    db.product.upsert({ where: { slug: "grilled-pork-rice" }, update: {}, create: { name: "Grilled Pork Rice", slug: "grilled-pork-rice", price: 55000, costPrice: 22000, categoryId: catMain.id, vatId: vat8.id, unitId: uPlate.id, sortOrder: 1 } }),
    db.product.upsert({ where: { slug: "beef-noodle-soup" }, update: {}, create: { name: "Beef Noodle Soup", slug: "beef-noodle-soup", price: 65000, costPrice: 28000, categoryId: catMain.id, vatId: vat8.id, unitId: uBowl.id, sortOrder: 2 } }),
    db.product.upsert({ where: { slug: "spicy-beef-noodle" }, update: {}, create: { name: "Spicy Beef Noodle", slug: "spicy-beef-noodle", price: 55000, costPrice: 24000, categoryId: catMain.id, vatId: vat8.id, unitId: uBowl.id, sortOrder: 3 } }),
    db.product.upsert({ where: { slug: "crispy-chicken-rice" }, update: {}, create: { name: "Crispy Chicken Rice", slug: "crispy-chicken-rice", price: 60000, costPrice: 25000, categoryId: catMain.id, vatId: vat8.id, unitId: uPlate.id, sortOrder: 4 } }),
    db.product.upsert({ where: { slug: "seafood-stir-fry-noodle" }, update: {}, create: { name: "Seafood Stir-Fry Noodle", slug: "seafood-stir-fry-noodle", price: 75000, costPrice: 35000, categoryId: catMain.id, vatId: vat8.id, unitId: uPlate.id, sortOrder: 5 } }),
    db.product.upsert({ where: { slug: "shaking-beef" }, update: {}, create: { name: "Shaking Beef", slug: "shaking-beef", price: 120000, costPrice: 60000, categoryId: catMain.id, vatId: vat8.id, unitId: uPlate.id, sortOrder: 6 } }),
    // Starters
    db.product.upsert({ where: { slug: "spring-rolls" }, update: {}, create: { name: "Spring Rolls (4 pcs)", slug: "spring-rolls", price: 45000, costPrice: 18000, categoryId: catStarter.id, vatId: vat8.id, unitId: uServing.id, sortOrder: 1 } }),
    db.product.upsert({ where: { slug: "fresh-rolls" }, update: {}, create: { name: "Fresh Shrimp Rolls", slug: "fresh-rolls", price: 40000, costPrice: 16000, categoryId: catStarter.id, vatId: vat8.id, unitId: uServing.id, sortOrder: 2 } }),
    db.product.upsert({ where: { slug: "crab-soup" }, update: {}, create: { name: "Crab Soup", slug: "crab-soup", price: 50000, costPrice: 20000, categoryId: catStarter.id, vatId: vat8.id, unitId: uBowl.id, sortOrder: 3 } }),
    // Beverages
    db.product.upsert({ where: { slug: "iced-tea" }, update: {}, create: { name: "Iced Tea", slug: "iced-tea", price: 5000, costPrice: 1000, categoryId: catDrink.id, vatId: vat8.id, unitId: uGlass.id, sortOrder: 1 } }),
    db.product.upsert({ where: { slug: "fresh-orange-juice" }, update: {}, create: { name: "Fresh Orange Juice", slug: "fresh-orange-juice", price: 45000, costPrice: 18000, categoryId: catDrink.id, vatId: vat8.id, unitId: uGlass.id, sortOrder: 2 } }),
    db.product.upsert({ where: { slug: "fresh-coconut" }, update: {}, create: { name: "Fresh Coconut Water", slug: "fresh-coconut", price: 35000, costPrice: 15000, categoryId: catDrink.id, vatId: vat8.id, unitId: uGlass.id, sortOrder: 3 } }),
    db.product.upsert({ where: { slug: "lemon-soda" }, update: {}, create: { name: "Lemon Soda", slug: "lemon-soda", price: 25000, costPrice: 8000, categoryId: catDrink.id, vatId: vat8.id, unitId: uGlass.id, sortOrder: 4 } }),
    // Coffee
    db.product.upsert({ where: { slug: "black-coffee" }, update: {}, create: { name: "Black Coffee", slug: "black-coffee", price: 25000, costPrice: 8000, categoryId: catCoffee.id, vatId: vat8.id, unitId: uGlass.id, sortOrder: 1 } }),
    db.product.upsert({ where: { slug: "milk-coffee" }, update: {}, create: { name: "Milk Coffee", slug: "milk-coffee", price: 30000, costPrice: 10000, categoryId: catCoffee.id, vatId: vat8.id, unitId: uGlass.id, sortOrder: 2 } }),
    db.product.upsert({ where: { slug: "white-coffee" }, update: {}, create: { name: "White Coffee", slug: "white-coffee", price: 30000, costPrice: 10000, categoryId: catCoffee.id, vatId: vat8.id, unitId: uGlass.id, sortOrder: 3 } }),
    // Beer & Wine
    db.product.upsert({ where: { slug: "local-beer" }, update: {}, create: { name: "Local Beer", slug: "local-beer", price: 20000, costPrice: 11000, categoryId: catBeer.id, vatId: vat10.id, exciseTaxId: exciseBeer.id, unitId: uBottle.id, sortOrder: 1 } }),
    db.product.upsert({ where: { slug: "heineken" }, update: {}, create: { name: "Heineken", slug: "heineken", price: 30000, costPrice: 18000, categoryId: catBeer.id, vatId: vat10.id, exciseTaxId: exciseBeer.id, unitId: uBottle.id, sortOrder: 2 } }),
    db.product.upsert({ where: { slug: "tiger-beer" }, update: {}, create: { name: "Tiger", slug: "tiger-beer", price: 25000, costPrice: 15000, categoryId: catBeer.id, vatId: vat10.id, exciseTaxId: exciseBeer.id, unitId: uCan.id, sortOrder: 3 } }),
    // Desserts
    db.product.upsert({ where: { slug: "mixed-pudding" }, update: {}, create: { name: "Mixed Pudding", slug: "mixed-pudding", price: 25000, costPrice: 8000, categoryId: catDessert.id, vatId: vat8.id, unitId: uGlass.id, sortOrder: 1 } }),
    db.product.upsert({ where: { slug: "fruit-platter" }, update: {}, create: { name: "Fruit Platter", slug: "fruit-platter", price: 40000, costPrice: 20000, categoryId: catDessert.id, vatId: vat8.id, unitId: uPlate.id, sortOrder: 2 } }),
    // Grill & Hotpot
    db.product.upsert({ where: { slug: "thai-hotpot" }, update: {}, create: { name: "Thai Hotpot", slug: "thai-hotpot", price: 250000, costPrice: 120000, categoryId: catGrill.id, vatId: vat8.id, unitId: uServing.id, sortOrder: 1 } }),
    db.product.upsert({ where: { slug: "beef-hotpot" }, update: {}, create: { name: "Beef Hotpot", slug: "beef-hotpot", price: 280000, costPrice: 140000, categoryId: catGrill.id, vatId: vat8.id, unitId: uServing.id, sortOrder: 2 } }),
  ]);
  console.log(`✅ Products (${products.length})`);

  // ========== TOPPING GROUPS ==========
  const tgSize = await db.toppingGroup.upsert({ where: { id: "tg-size" }, update: {}, create: { id: "tg-size", name: "Size", type: "SINGLE" } });
  const tgTopping = await db.toppingGroup.upsert({ where: { id: "tg-extra" }, update: {}, create: { id: "tg-extra", name: "Extra Toppings", type: "MULTIPLE" } });

  // Toppings
  await db.topping.upsert({ where: { id: "top-m" }, update: {}, create: { id: "top-m", name: "Size M", price: 0, toppingGroupId: tgSize.id, sortOrder: 1 } });
  await db.topping.upsert({ where: { id: "top-l" }, update: {}, create: { id: "top-l", name: "Size L", price: 10000, toppingGroupId: tgSize.id, sortOrder: 2 } });
  await db.topping.upsert({ where: { id: "top-beef" }, update: {}, create: { id: "top-beef", name: "Extra Beef", price: 20000, toppingGroupId: tgTopping.id, sortOrder: 1 } });
  await db.topping.upsert({ where: { id: "top-egg" }, update: {}, create: { id: "top-egg", name: "Fried Egg", price: 10000, toppingGroupId: tgTopping.id, sortOrder: 2 } });
  console.log("✅ Toppings");

  // Link toppings to products: Beef Noodle Soup + Spicy Beef Noodle
  const beefSoup = await db.product.findUniqueOrThrow({ where: { slug: "beef-noodle-soup" } });
  const spicyNoodle = await db.product.findUniqueOrThrow({ where: { slug: "spicy-beef-noodle" } });
  for (const p of [beefSoup, spicyNoodle]) {
    await db.productToppingGroup.upsert({ where: { productId_toppingGroupId: { productId: p.id, toppingGroupId: tgSize.id } }, update: {}, create: { productId: p.id, toppingGroupId: tgSize.id } });
    await db.productToppingGroup.upsert({ where: { productId_toppingGroupId: { productId: p.id, toppingGroupId: tgTopping.id } }, update: {}, create: { productId: p.id, toppingGroupId: tgTopping.id } });
  }

  // ========== INGREDIENTS ==========
  const ingredients = await Promise.all([
    db.ingredient.upsert({ where: { id: "ing-pork" }, update: {}, create: { id: "ing-pork", name: "Pork", purchaseUnit: "Kg", baseUnit: "Gram", conversionFactor: 1000, currentStock: 10, minStock: 2, purchasePrice: 120000, costPerBaseUnit: 120, supplier: "Local Market" } }),
    db.ingredient.upsert({ where: { id: "ing-beef" }, update: {}, create: { id: "ing-beef", name: "Beef", purchaseUnit: "Kg", baseUnit: "Gram", conversionFactor: 1000, currentStock: 8, minStock: 1.5, purchasePrice: 280000, costPerBaseUnit: 280, supplier: "Local Market" } }),
    db.ingredient.upsert({ where: { id: "ing-chicken" }, update: {}, create: { id: "ing-chicken", name: "Chicken", purchaseUnit: "Kg", baseUnit: "Gram", conversionFactor: 1000, currentStock: 6, minStock: 1, purchasePrice: 90000, costPerBaseUnit: 90, supplier: "Farm Direct" } }),
    db.ingredient.upsert({ where: { id: "ing-shrimp" }, update: {}, create: { id: "ing-shrimp", name: "Shrimp", purchaseUnit: "Kg", baseUnit: "Gram", conversionFactor: 1000, currentStock: 3, minStock: 0.5, purchasePrice: 320000, costPerBaseUnit: 320, supplier: "Seafood Market" } }),
    db.ingredient.upsert({ where: { id: "ing-rice" }, update: {}, create: { id: "ing-rice", name: "Rice", purchaseUnit: "Kg", baseUnit: "Gram", conversionFactor: 1000, currentStock: 25, minStock: 5, purchasePrice: 20000, costPerBaseUnit: 20, supplier: "Rice Supplier" } }),
    db.ingredient.upsert({ where: { id: "ing-rice-noodle" }, update: {}, create: { id: "ing-rice-noodle", name: "Rice Noodle", purchaseUnit: "Kg", baseUnit: "Gram", conversionFactor: 1000, currentStock: 8, minStock: 1, purchasePrice: 25000, costPerBaseUnit: 25 } }),
    db.ingredient.upsert({ where: { id: "ing-vermicelli" }, update: {}, create: { id: "ing-vermicelli", name: "Vermicelli", purchaseUnit: "Kg", baseUnit: "Gram", conversionFactor: 1000, currentStock: 6, minStock: 1, purchasePrice: 18000, costPerBaseUnit: 18 } }),
    db.ingredient.upsert({ where: { id: "ing-egg-noodle" }, update: {}, create: { id: "ing-egg-noodle", name: "Egg Noodle", purchaseUnit: "Kg", baseUnit: "Gram", conversionFactor: 1000, currentStock: 5, minStock: 1, purchasePrice: 30000, costPerBaseUnit: 30 } }),
    db.ingredient.upsert({ where: { id: "ing-egg" }, update: {}, create: { id: "ing-egg", name: "Eggs", purchaseUnit: "Dozen", baseUnit: "Piece", conversionFactor: 12, currentStock: 60, minStock: 10, purchasePrice: 45000, costPerBaseUnit: 3750, supplier: "Egg Farm" } }),
    db.ingredient.upsert({ where: { id: "ing-herbs" }, update: {}, create: { id: "ing-herbs", name: "Fresh Herbs", purchaseUnit: "Kg", baseUnit: "Gram", conversionFactor: 1000, currentStock: 3, minStock: 0.5, purchasePrice: 40000, costPerBaseUnit: 40, supplier: "Local Market" } }),
    db.ingredient.upsert({ where: { id: "ing-spices" }, update: {}, create: { id: "ing-spices", name: "Mixed Spices", purchaseUnit: "Kg", baseUnit: "Gram", conversionFactor: 1000, currentStock: 5, minStock: 1, purchasePrice: 100000, costPerBaseUnit: 100 } }),
    db.ingredient.upsert({ where: { id: "ing-coffee" }, update: {}, create: { id: "ing-coffee", name: "Coffee Beans", purchaseUnit: "Kg", baseUnit: "Gram", conversionFactor: 1000, currentStock: 5, minStock: 1, purchasePrice: 200000, costPerBaseUnit: 200 } }),
    db.ingredient.upsert({ where: { id: "ing-condensed-milk" }, update: {}, create: { id: "ing-condensed-milk", name: "Condensed Milk", purchaseUnit: "Case", baseUnit: "Can", conversionFactor: 48, currentStock: 96, minStock: 12, purchasePrice: 720000, costPerBaseUnit: 15000 } }),
    db.ingredient.upsert({ where: { id: "ing-sugar" }, update: {}, create: { id: "ing-sugar", name: "Sugar", purchaseUnit: "Kg", baseUnit: "Gram", conversionFactor: 1000, currentStock: 10, minStock: 2, purchasePrice: 22000, costPerBaseUnit: 22 } }),
    db.ingredient.upsert({ where: { id: "ing-orange" }, update: {}, create: { id: "ing-orange", name: "Fresh Oranges", purchaseUnit: "Kg", baseUnit: "Gram", conversionFactor: 1000, currentStock: 8, minStock: 2, purchasePrice: 50000, costPerBaseUnit: 50, supplier: "Fruit Supplier" } }),
    db.ingredient.upsert({ where: { id: "ing-cooking-oil" }, update: {}, create: { id: "ing-cooking-oil", name: "Cooking Oil", purchaseUnit: "Liter", baseUnit: "Ml", conversionFactor: 1000, currentStock: 10, minStock: 2, purchasePrice: 55000, costPerBaseUnit: 55 } }),
  ]);
  console.log(`✅ Ingredients (${ingredients.length})`);

  // ========== RECIPES ==========
  const recipeData: { productSlug: string; items: { ingredientId: string; quantity: number; unitId: string }[] }[] = [
    { productSlug: "grilled-pork-rice", items: [
      { ingredientId: "ing-pork", quantity: 200, unitId: uGram.id },
      { ingredientId: "ing-rice", quantity: 250, unitId: uGram.id },
      { ingredientId: "ing-egg", quantity: 1, unitId: uPiece.id },
      { ingredientId: "ing-spices", quantity: 10, unitId: uGram.id },
      { ingredientId: "ing-cooking-oil", quantity: 15, unitId: uMl.id },
    ]},
    { productSlug: "beef-noodle-soup", items: [
      { ingredientId: "ing-beef", quantity: 150, unitId: uGram.id },
      { ingredientId: "ing-rice-noodle", quantity: 200, unitId: uGram.id },
      { ingredientId: "ing-herbs", quantity: 30, unitId: uGram.id },
      { ingredientId: "ing-spices", quantity: 15, unitId: uGram.id },
    ]},
    { productSlug: "spicy-beef-noodle", items: [
      { ingredientId: "ing-beef", quantity: 120, unitId: uGram.id },
      { ingredientId: "ing-pork", quantity: 80, unitId: uGram.id },
      { ingredientId: "ing-vermicelli", quantity: 200, unitId: uGram.id },
      { ingredientId: "ing-spices", quantity: 15, unitId: uGram.id },
    ]},
    { productSlug: "crispy-chicken-rice", items: [
      { ingredientId: "ing-chicken", quantity: 250, unitId: uGram.id },
      { ingredientId: "ing-rice", quantity: 250, unitId: uGram.id },
      { ingredientId: "ing-cooking-oil", quantity: 20, unitId: uMl.id },
      { ingredientId: "ing-spices", quantity: 10, unitId: uGram.id },
    ]},
    { productSlug: "seafood-stir-fry-noodle", items: [
      { ingredientId: "ing-shrimp", quantity: 100, unitId: uGram.id },
      { ingredientId: "ing-egg-noodle", quantity: 200, unitId: uGram.id },
      { ingredientId: "ing-herbs", quantity: 20, unitId: uGram.id },
      { ingredientId: "ing-cooking-oil", quantity: 20, unitId: uMl.id },
      { ingredientId: "ing-spices", quantity: 10, unitId: uGram.id },
    ]},
    { productSlug: "shaking-beef", items: [
      { ingredientId: "ing-beef", quantity: 300, unitId: uGram.id },
      { ingredientId: "ing-cooking-oil", quantity: 25, unitId: uMl.id },
      { ingredientId: "ing-spices", quantity: 15, unitId: uGram.id },
    ]},
    { productSlug: "spring-rolls", items: [
      { ingredientId: "ing-pork", quantity: 150, unitId: uGram.id },
      { ingredientId: "ing-shrimp", quantity: 50, unitId: uGram.id },
      { ingredientId: "ing-cooking-oil", quantity: 30, unitId: uMl.id },
      { ingredientId: "ing-spices", quantity: 10, unitId: uGram.id },
    ]},
    { productSlug: "fresh-rolls", items: [
      { ingredientId: "ing-shrimp", quantity: 60, unitId: uGram.id },
      { ingredientId: "ing-pork", quantity: 80, unitId: uGram.id },
      { ingredientId: "ing-herbs", quantity: 20, unitId: uGram.id },
    ]},
    { productSlug: "crab-soup", items: [
      { ingredientId: "ing-shrimp", quantity: 50, unitId: uGram.id },
      { ingredientId: "ing-egg", quantity: 1, unitId: uPiece.id },
      { ingredientId: "ing-spices", quantity: 10, unitId: uGram.id },
    ]},
    { productSlug: "fresh-orange-juice", items: [
      { ingredientId: "ing-orange", quantity: 300, unitId: uGram.id },
      { ingredientId: "ing-sugar", quantity: 10, unitId: uGram.id },
    ]},
    { productSlug: "black-coffee", items: [
      { ingredientId: "ing-coffee", quantity: 25, unitId: uGram.id },
    ]},
    { productSlug: "milk-coffee", items: [
      { ingredientId: "ing-coffee", quantity: 25, unitId: uGram.id },
      { ingredientId: "ing-condensed-milk", quantity: 0.05, unitId: uCan.id },
    ]},
    { productSlug: "white-coffee", items: [
      { ingredientId: "ing-coffee", quantity: 15, unitId: uGram.id },
      { ingredientId: "ing-condensed-milk", quantity: 0.08, unitId: uCan.id },
    ]},
  ];

  for (const r of recipeData) {
    const product = await db.product.findUniqueOrThrow({ where: { slug: r.productSlug } });
    for (const item of r.items) {
      await db.ingredientRecipe.upsert({
        where: { id: `rec-${r.productSlug}-${item.ingredientId}` },
        update: { quantity: item.quantity },
        create: {
          id: `rec-${r.productSlug}-${item.ingredientId}`,
          productId: product.id, ingredientId: item.ingredientId, quantity: item.quantity, unitId: item.unitId,
        },
      });
    }
    // Calculate cost
    await db.product.update({ where: { id: product.id }, data: { costPrice: await calcProductCost(product.id) } });
  }
  console.log(`✅ Recipes (${recipeData.length} products)`);

  // ========== AREAS & TABLES ==========
  const areaFloor1 = await db.area.upsert({ where: { id: "area-floor1" }, update: { type: "RESTAURANT" }, create: { id: "area-floor1", name: "Floor 1", type: "RESTAURANT", sortOrder: 1 } });
  const areaFloor2 = await db.area.upsert({ where: { id: "area-floor2" }, update: { type: "RESTAURANT" }, create: { id: "area-floor2", name: "Floor 2", type: "RESTAURANT", sortOrder: 2 } });
  const areaTerrace = await db.area.upsert({ where: { id: "area-terrace" }, update: { type: "RESTAURANT" }, create: { id: "area-terrace", name: "Terrace", type: "RESTAURANT", sortOrder: 3 } });
  const areaVIP = await db.area.upsert({ where: { id: "area-vip" }, update: { type: "RESTAURANT" }, create: { id: "area-vip", name: "VIP Room", type: "RESTAURANT", sortOrder: 4 } });
  const areaTakeaway = await db.area.upsert({ where: { id: "area-takeaway" }, update: {}, create: { id: "area-takeaway", name: "Takeaway", type: "TAKEAWAY", sortOrder: 5 } });

  // Floor 1: tables T01-T10
  for (let i = 1; i <= 10; i++) {
    const name = `T${String(i).padStart(2, "0")}`;
    const cap = [2, 4, 4, 6, 2, 4, 8, 4, 2, 6][i - 1];
    await db.table.upsert({ where: { id: `t-${name}` }, update: {}, create: { id: `t-${name}`, name, areaId: areaFloor1.id, capacity: cap } });
  }
  // Floor 2: tables T11-T18
  for (let i = 11; i <= 18; i++) {
    const name = `T${String(i).padStart(2, "0")}`;
    const cap = [4, 6, 4, 8, 4, 2, 4, 6][i - 11];
    await db.table.upsert({ where: { id: `t-${name}` }, update: {}, create: { id: `t-${name}`, name, areaId: areaFloor2.id, capacity: cap } });
  }
  // Terrace: S01-S06
  for (let i = 1; i <= 6; i++) {
    const name = `S${String(i).padStart(2, "0")}`;
    await db.table.upsert({ where: { id: `t-${name}` }, update: {}, create: { id: `t-${name}`, name, areaId: areaTerrace.id, capacity: 4 } });
  }
  // VIP: V01-V04
  for (let i = 1; i <= 4; i++) {
    const name = `V${String(i).padStart(2, "0")}`;
    await db.table.upsert({ where: { id: `t-${name}` }, update: {}, create: { id: `t-${name}`, name, areaId: areaVIP.id, capacity: [8, 10, 6, 12][i - 1] } });
  }
  // Takeaway
  await db.table.upsert({ where: { id: "t-takeaway" }, update: {}, create: { id: "t-takeaway", name: "Takeaway", areaId: areaTakeaway.id, capacity: 0 } });
  console.log("✅ Areas (5) & Tables (29)");

  // ========== PAYMENT METHODS ==========
  await db.paymentMethod.upsert({ where: { code: "CASH" }, update: {}, create: { name: "Cash", code: "CASH", sortOrder: 1 } });
  await db.paymentMethod.upsert({ where: { code: "CARD" }, update: {}, create: { name: "Credit/Debit Card", code: "CARD", sortOrder: 2 } });
  await db.paymentMethod.upsert({ where: { code: "PIX" }, update: {}, create: { name: "PIX", code: "PIX", sortOrder: 3 } });
  console.log("✅ Payment Methods");

  // ========== CASH FLOW CATEGORIES ==========
  await db.cashFlowCategory.upsert({ where: { id: "inc-sales" }, update: {}, create: { id: "inc-sales", name: "Sales Revenue", type: "INCOME", sortOrder: 1 } });
  await db.cashFlowCategory.upsert({ where: { id: "inc-other" }, update: {}, create: { id: "inc-other", name: "Other Income", type: "INCOME", sortOrder: 2 } });
  await db.cashFlowCategory.upsert({ where: { id: "exp-stock" }, update: {}, create: { id: "exp-stock", name: "Inventory Purchase", type: "EXPENSE", sortOrder: 1 } });
  await db.cashFlowCategory.upsert({ where: { id: "exp-salary" }, update: {}, create: { id: "exp-salary", name: "Staff Salary", type: "EXPENSE", sortOrder: 2 } });
  await db.cashFlowCategory.upsert({ where: { id: "exp-rent" }, update: {}, create: { id: "exp-rent", name: "Rent", type: "EXPENSE", sortOrder: 3 } });
  await db.cashFlowCategory.upsert({ where: { id: "exp-other" }, update: {}, create: { id: "exp-other", name: "Other Expenses", type: "EXPENSE", sortOrder: 4 } });
  console.log("✅ Cash Flow Categories");

  // ========== SYSTEM MODULES ==========
  await db.systemModule.upsert({ where: { name: "kds" }, update: {}, create: { name: "kds", enabled: false } });
  await db.systemModule.upsert({ where: { name: "inventory" }, update: {}, create: { name: "inventory", enabled: true } });
  await db.systemModule.upsert({ where: { name: "karaoke" }, update: {}, create: { name: "karaoke", enabled: false } });
  console.log("✅ System Modules");

  // ========== SERVICE CHARGES ==========
  await db.serviceCharge.upsert({
    where: { id: "sc-service-fee" },
    update: {},
    create: {
      id: "sc-service-fee",
      name: "Service Fee",
      type: "SERVICE_FEE",
      value: 5,
      scope: "ALL",
      applyCondition: "ALL_DAYS",
      isActive: true,
    },
  });
  await db.serviceCharge.upsert({
    where: { id: "sc-holiday" },
    update: {},
    create: {
      id: "sc-holiday",
      name: "Holiday Surcharge",
      type: "FIXED",
      value: 5000,
      scope: "ALL",
      applyCondition: "HOLIDAY",
      isActive: true,
    },
  });
  console.log("✅ Service Charges (Service Fee 5% + Holiday Surcharge)");

  // ========== HOLIDAYS ==========
  const holidays = [
    { name: "New Year's Day", date: "2026-01-01" },
    { name: "Carnival Monday", date: "2026-02-16" },
    { name: "Carnival Tuesday", date: "2026-02-17" },
    { name: "Good Friday", date: "2026-04-03" },
    { name: "Tiradentes Day", date: "2026-04-21" },
    { name: "Labour Day", date: "2026-05-01" },
    { name: "Corpus Christi", date: "2026-06-04" },
    { name: "Independence Day", date: "2026-09-07" },
    { name: "Our Lady of Aparecida", date: "2026-10-12" },
    { name: "All Souls' Day", date: "2026-11-02" },
    { name: "Christmas Day", date: "2026-12-25" },
  ];
  for (const h of holidays) {
    await db.holiday.upsert({ where: { date: new Date(h.date) }, update: {}, create: { ...h, date: new Date(h.date) } });
  }
  console.log("✅ Holidays (11 days)");

  // ========== SUMMARY ==========
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🎉 Seed complete!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   👤 admin / admin123");
  console.log(`   🍽️  ${products.length} products`);
  console.log(`   📦  ${ingredients.length} ingredients`);
  console.log(`   📋  ${recipeData.length} recipes`);
  console.log(`   🏠  5 areas, 29 tables`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

async function calcProductCost(productId: string): Promise<number> {
  const recipes = await db.ingredientRecipe.findMany({ where: { productId }, include: { ingredient: true } });
  return recipes.reduce((sum, r) => sum + r.ingredient.costPerBaseUnit * r.quantity, 0);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
