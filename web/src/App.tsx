import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { AppLayout } from "./components/layout/AppLayout";
import { ProfileLayout } from "./components/profile/ProfileLayout";
import { AdminCategoriesPage } from "./pages/AdminCategoriesPage";
import { AdminOrdersPage } from "./pages/AdminOrdersPage";
import { AdminPage } from "./pages/AdminPage";
import { CartPage } from "./pages/CartPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { OrderStatusPage } from "./pages/OrderStatusPage";
import { OrderSummaryPage } from "./pages/OrderSummaryPage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { ProfileDataPage } from "./pages/ProfileDataPage";
import { ProfileOrdersPage } from "./pages/ProfileOrdersPage";
import { AdminRoute } from "./routes/AdminRoute";
import { UserRoute } from "./routes/UserRoute";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="products/:id" element={<ProductDetailPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route
              path="checkout"
              element={
                <UserRoute>
                  <CheckoutPage />
                </UserRoute>
              }
            />
            <Route
              path="orders/:orderId/summary"
              element={
                <UserRoute>
                  <OrderSummaryPage />
                </UserRoute>
              }
            />
            <Route
              path="orders/:orderId/status"
              element={
                <UserRoute>
                  <OrderStatusPage />
                </UserRoute>
              }
            />
            <Route path="login" element={<LoginPage />} />
            <Route
              path="profil"
              element={
                <UserRoute>
                  <ProfileLayout />
                </UserRoute>
              }
            >
              <Route index element={<Navigate to="dane" replace />} />
              <Route path="dane" element={<ProfileDataPage />} />
              <Route path="zamowienia" element={<ProfileOrdersPage />} />
            </Route>
            <Route
              path="admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
            <Route
              path="admin/orders"
              element={
                <AdminRoute>
                  <AdminOrdersPage />
                </AdminRoute>
              }
            />
            <Route
              path="admin/categories"
              element={
                <AdminRoute>
                  <AdminCategoriesPage />
                </AdminRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
